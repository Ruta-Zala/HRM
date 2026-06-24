"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatIsoDate } from "@/lib/attendance/time";
import { formatLeaveDayCount } from "@/lib/attendance/leave-display";
import { Switch } from "@/components/ui/switch";

type UnpaidLeaveEntry = {
  slot: string;
  date: string;
  duration: string;
  reason: string;
  status: string;
  rejectReason: string;
  days: number;
};

type LeaveApplication = {
  id: string;
  leaveType: string;
  slot: string;
  date: string;
  duration: string;
  reason: string;
  status: string;
  rejectReason: string;
  days?: number;
};

type LeaveBalanceResponse = {
  success: boolean;
  birthdayDate?: string;
  birthdayDateIso?: string;
  paid: {
    allocated: number;
    used: number;
    remaining: number;
  };
  casual: {
    allocated: number;
    used: number;
    remaining: number;
  };
  sick: {
    allocated: number;
    used: number;
    remaining: number;
  };
  unpaid: {
    used: number;
    leaves: UnpaidLeaveEntry[];
  };
  birthday: {
    allocated: number;
    used: number;
    remaining: number;
  };
  applications?: LeaveApplication[];
};

function statusBadgeVariant(status: string): "default" | "success" | "warning" | "danger" {
  const normalized = status.trim().toLowerCase();
  if (normalized === "accepted") return "success";
  if (normalized === "applied") return "warning";
  if (normalized === "rejected") return "danger";
  return "default";
}

function formatLeaveTypeLabel(leaveType: string): string {
  const labels: Record<string, string> = {
    paid: "Paid",
    casual: "Casual",
    sick: "Sick",
    birthday: "Birthday",
    unpaid: "Unpaid",
  };
  return labels[leaveType] ?? leaveType;
}

const LEAVE_TYPE_OPTIONS = [
  { value: "paid", label: "Paid" },
  { value: "casual", label: "Casual" },
  { value: "sick", label: "Sick" },
  { value: "birthday", label: "Birthday" },
  { value: "unpaid", label: "Unpaid" },
] as const;

type LeaveTypeValue = (typeof LEAVE_TYPE_OPTIONS)[number]["value"];

function getLeaveTypeRemaining(
  balances: LeaveBalanceResponse,
  leaveType: LeaveTypeValue,
): number | null {
  if (leaveType === "unpaid") return null;

  return balances[leaveType].remaining;
}

function getAvailableLeaveTypes(
  balances: LeaveBalanceResponse | null,
  loading: boolean,
): Array<(typeof LEAVE_TYPE_OPTIONS)[number]> {
  if (loading || !balances) {
    return [...LEAVE_TYPE_OPTIONS];
  }

  return LEAVE_TYPE_OPTIONS.filter((option) => {
    if (option.value === "unpaid") return true;
    return (getLeaveTypeRemaining(balances, option.value) ?? 0) > 0;
  });
}

export default function LeaveDeskPage() {
  const [isSingleDay, setIsSingleDay] = useState(true);

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [birthdayLeaveDate, setBirthdayLeaveDate] = useState("");

  const [leaveType, setLeaveType] = useState("paid");
  const [duration, setDuration] = useState("full");
  const [reason, setReason] = useState("");

  const [submitting, setSubmitting] = useState(false);

  const [balancesLoading, setBalancesLoading] = useState(true);
  const [balances, setBalances] = useState<LeaveBalanceResponse | null>(null);

  const formDisabled = balancesLoading || submitting;

  const availableLeaveTypes = getAvailableLeaveTypes(balances, balancesLoading);
  const resolvedLeaveType = availableLeaveTypes.some((option) => option.value === leaveType)
    ? leaveType
    : (availableLeaveTypes[0]?.value ?? "unpaid");

  const isBirthdayLeave = resolvedLeaveType === "birthday";
  const birthdayLeaveDateValue =
    birthdayLeaveDate || (isBirthdayLeave ? (balances?.birthdayDateIso ?? "") : "");

  const loadBalances = useCallback(async () => {
    setBalancesLoading(true);
    try {
      const res = await fetch("/api/employee/leaves");
      const data = await res.json();

      if (data.success) {
        setBalances(data);
        if (data.birthdayDateIso) {
          setBirthdayLeaveDate((current) => current || data.birthdayDateIso);
        }
      }
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Failed to load balances");
    } finally {
      setBalancesLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadBalances();
  }, [loadBalances]);

  const minLeaveDate = formatIsoDate();

  const handleSingleDayChange = (checked: boolean) => {
    setIsSingleDay(checked);

    if (checked) {
      setToDate(fromDate);
    }
  };

  const handleFromDateChange = (value: string) => {
    setFromDate(value);

    if (isSingleDay) {
      setToDate(value);
    }
  };

  const totalDays = (() => {
    if (isBirthdayLeave) return 1;
    if (!fromDate) return 0;

    const endDate = isSingleDay ? fromDate : toDate;

    if (!endDate) return 0;

    const start = new Date(fromDate);
    const end = new Date(endDate);

    const diff = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    if (duration === "full") {
      return diff;
    }

    return diff - 0.5;
  })();

  const submitLeaveRequest = async () => {
    if (isBirthdayLeave) {
      if (!birthdayLeaveDateValue) {
        window.alert("Please select your birthday leave date");
        return;
      }
    } else {
      if (!fromDate) {
        window.alert("Please select a date");
        return;
      }

      if (!isSingleDay && !toDate) {
        window.alert("Please select end date");
        return;
      }

      if (!reason.trim()) {
        window.alert("Please provide a reason");
        return;
      }
    }

    setSubmitting(true);
    setBalancesLoading(true);

    try {
      const body = isBirthdayLeave
        ? { leaveType: "birthday", fromDate: birthdayLeaveDateValue }
        : {
            leaveType: resolvedLeaveType,
            duration,
            fromDate,
            toDate: isSingleDay ? fromDate : toDate,
            totalDays,
            reason,
          };

      const res = await fetch("/api/employee/leaves", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.message);
      }

      setFromDate("");
      setToDate("");
      setBirthdayLeaveDate("");
      setReason("");
      setLeaveType("paid");
      setDuration("full");
      setIsSingleDay(true);
      await loadBalances();
      window.alert("Leave request submitted");
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Failed to submit leave request");
    } finally {
      setSubmitting(false);
      setBalancesLoading(false);
    }
  };

  const applications = balances?.applications ?? [];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Leave desk"
        description="Apply for paid, sick, casual, birthday, or unpaid leave. Submitted requests show as Applied (pending approval) until HR accepts or rejects them."
      />
      <div className="grid items-start gap-4 lg:grid-cols-3">
        <Card className="h-fit lg:col-span-2">
          <CardHeader>
            <CardTitle>Apply for Leave</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Leave Type</Label>

              <Select
                value={resolvedLeaveType}
                onChange={(e) => setLeaveType(e.target.value)}
                disabled={formDisabled}
              >
                {availableLeaveTypes.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              {!balancesLoading &&
              balances &&
              availableLeaveTypes.length < LEAVE_TYPE_OPTIONS.length ? (
                <p className="text-ex-muted text-xs">
                  Leave types with no remaining balance are hidden from this list.
                </p>
              ) : null}
            </div>

            {isBirthdayLeave ? (
              <div className="space-y-2 sm:col-span-2">
                <Label>Birthday date</Label>
                <Input
                  type="date"
                  min={minLeaveDate}
                  value={birthdayLeaveDateValue}
                  onChange={(e) => setBirthdayLeaveDate(e.target.value)}
                  disabled={formDisabled}
                />
                <p className="text-ex-muted text-xs">
                  {balances?.birthdayDateIso
                    ? "Pre-filled from your employee profile. You can change it before submitting."
                    : "Select your birthday leave date. No reason or duration is required."}
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-2 sm:col-span-2">
                  <div className="flex items-center justify-between">
                    <Label>Leave Dates</Label>

                    <div className="flex items-center gap-2">
                      <Switch
                        checked={isSingleDay}
                        onCheckedChange={handleSingleDayChange}
                        disabled={formDisabled}
                      />
                      <span className="text-sm">Single Day</span>
                    </div>
                  </div>

                  <div className={isSingleDay ? "grid gap-4" : "grid gap-4 sm:grid-cols-2"}>
                    <div className="space-y-2">
                      <Label>{isSingleDay ? "Date" : "From Date"}</Label>

                      <Input
                        type="date"
                        min={minLeaveDate}
                        value={fromDate}
                        onChange={(e) => handleFromDateChange(e.target.value)}
                        disabled={formDisabled}
                      />
                    </div>

                    {!isSingleDay && (
                      <div className="space-y-2">
                        <Label>To Date</Label>

                        <Input
                          type="date"
                          min={fromDate || minLeaveDate}
                          value={toDate}
                          onChange={(e) => setToDate(e.target.value)}
                          disabled={formDisabled}
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Duration</Label>

                  <Select
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    disabled={formDisabled}
                  >
                    <option value="full">Full Day</option>
                    <option value="half_am">Half Day · Morning</option>
                    <option value="half_pm">Half Day · Afternoon</option>
                  </Select>
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label>Reason</Label>

                  <Textarea
                    rows={3}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Reason for leave"
                    disabled={formDisabled}
                  />
                </div>

                <div className="sm:col-span-2">
                  <Badge variant="accent">
                    Total Leave: {totalDays} day
                    {totalDays !== 1 ? "s" : ""}
                  </Badge>
                </div>
              </>
            )}

            <Button
              className="w-fit sm:col-span-2"
              onClick={submitLeaveRequest}
              disabled={formDisabled || (isBirthdayLeave && !birthdayLeaveDateValue)}
            >
              {formDisabled ? (submitting ? "Submitting..." : "Loading...") : "Submit for Approval"}
            </Button>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Balances</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span>Paid Leave</span>
              <Badge>
                {balancesLoading ? "..." : (balances?.paid?.used ?? 0)}/
                {balances?.paid?.allocated ?? 0}
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <span>Sick Leave</span>
              <Badge>
                {balancesLoading ? "..." : (balances?.sick?.used ?? 0)}/
                {balances?.sick?.allocated ?? 0}
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <span>Casual Leave</span>
              <Badge>
                {balancesLoading ? "..." : (balances?.casual?.used ?? 0)}/
                {balances?.casual?.allocated ?? 0}
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <span>Birthday Leave</span>
              <Badge variant="accent">
                {balancesLoading ? "..." : (balances?.birthday?.used ?? 0)}/
                {balances?.birthday?.allocated ?? 0}
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <span>Unpaid Leave</span>
              <Badge variant="accent">
                {balancesLoading ? "..." : (balances?.unpaid?.used ?? 0)} used
              </Badge>
            </div>

            {(balances?.unpaid?.leaves?.length ?? 0) > 0 && (
              <div className="space-y-2 border-t pt-3">
                <p className="text-ex-muted text-xs font-medium tracking-wide uppercase">
                  Unpaid leave
                </p>
                <ul className="max-h-48 space-y-2 overflow-y-auto">
                  {balances?.unpaid?.leaves.map((leave, index) => (
                    <li
                      key={`${leave.date}-${leave.slot}-${index}`}
                      className="bg-ex-surface rounded-md border p-2 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">
                          {leave.date} {leave.duration ? ` · ${leave.duration}` : ""}
                        </span>
                        <div className="flex shrink-0 items-center gap-2">
                          {leave.status ? (
                            <Badge variant={statusBadgeVariant(leave.status)}>{leave.status}</Badge>
                          ) : null}
                          <span className="text-ex-muted">{formatLeaveDayCount(leave.days)}</span>
                        </div>
                      </div>
                      {leave.reason ? <p className="mt-1">{leave.reason}</p> : null}
                      {leave.rejectReason ? (
                        <p className="mt-1 text-rose-600 dark:text-rose-400">
                          Rejected: {leave.rejectReason}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {applications.length > 0 && (
              <div className="space-y-2 border-t pt-3">
                <p className="text-ex-muted text-xs font-medium tracking-wide uppercase">
                  Your leave applications
                </p>
                <ul className="max-h-56 space-y-2 overflow-y-auto">
                  {applications.map((application) => (
                    <li
                      key={application.id}
                      className="bg-ex-surface rounded-md border p-2 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">
                          {formatLeaveTypeLabel(application.leaveType)} · {application.date}
                          {application.duration ? ` · ${application.duration}` : ""}
                        </span>
                        <div className="flex shrink-0 items-center gap-2">
                          {application.status ? (
                            <Badge variant={statusBadgeVariant(application.status)}>
                              {application.status}
                            </Badge>
                          ) : null}
                          {(application.days ?? 0) > 0 ? (
                            <span className="text-ex-muted">
                              {formatLeaveDayCount(application.days ?? 0)}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      {application.reason ? <p className="mt-1">{application.reason}</p> : null}
                      {application.rejectReason ? (
                        <p className="mt-1 text-rose-600 dark:text-rose-400">
                          Rejected: {application.rejectReason}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-ex-muted text-xs">
              Applied leaves count toward balance until rejected. Accepted leaves are confirmed on
              your sheet with a green background; pending applied leaves use light gray.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
