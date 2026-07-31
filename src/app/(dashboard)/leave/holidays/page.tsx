"use client";

import { readResponseJson } from "@/lib/api/read-response-json";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useAuth } from "@/contexts/auth-provider";
import { canManageEmployees } from "@/lib/auth/roles";
import { formatIsoDate } from "@/lib/attendance/time";
import { toUserFacingActionError, toUserFacingFetchError } from "@/lib/api/user-facing-error";
import { COMPANY_HOLIDAYS_2026, type CompanyHoliday } from "@/lib/company-holidays";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

function holidayDateParts(holiday: CompanyHoliday) {
  const date = new Date(`${holiday.date}T00:00:00`);
  return {
    day: String(date.getDate()).padStart(2, "0"),
    weekday: new Intl.DateTimeFormat("en-IN", { weekday: "short" }).format(date),
    monthIndex: date.getMonth(),
  };
}

function HolidayItem({
  holiday,
  onEdit,
  onDelete,
  deleting,
}: {
  holiday: CompanyHoliday;
  onEdit?: (holiday: CompanyHoliday) => void;
  onDelete?: (holiday: CompanyHoliday) => void;
  deleting?: boolean;
}) {
  const date = holidayDateParts(holiday);
  const isLeave = holiday.type === "leave";
  const canAct = Boolean(onEdit || onDelete);

  return (
    <div className="border-ex-border bg-ex-elevated flex min-w-0 items-start gap-3 overflow-hidden rounded-xl border p-3">
      <div
        className={
          isLeave
            ? "bg-ex-secondary/15 text-ex-secondary flex size-11 shrink-0 flex-col items-center justify-center rounded-lg"
            : "bg-ex-accent/15 text-ex-accent flex size-11 shrink-0 flex-col items-center justify-center rounded-lg"
        }
      >
        <span className="text-sm leading-none font-semibold">{date.day}</span>
        <span className="mt-1 text-[10px] leading-none uppercase">{date.weekday}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-ex-primary truncate text-sm font-medium">{holiday.name}</p>
            <p className="text-ex-muted mt-0.5 text-xs">
              {new Intl.DateTimeFormat("en-IN", {
                day: "numeric",
                month: "long",
              }).format(new Date(`${holiday.date}T00:00:00`))}
            </p>
          </div>
          {canAct ? (
            <div className="flex shrink-0 items-center gap-0.5">
              {onEdit ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="size-8 p-0"
                  disabled={deleting}
                  aria-label={`Edit ${holiday.name}`}
                  onClick={() => onEdit(holiday)}
                >
                  <Pencil className="size-4" />
                </Button>
              ) : null}
              {onDelete ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="size-8 p-0"
                  disabled={deleting}
                  aria-label={`Delete ${holiday.name}`}
                  onClick={() => onDelete(holiday)}
                >
                  <Trash2 className="size-4 text-red-600 dark:text-red-400" />
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
        <Badge variant={isLeave ? "warning" : "accent"} className="mt-2">
          {isLeave ? "Leave" : "Celebration"}
        </Badge>
      </div>
    </div>
  );
}

export default function CompanyHolidaysPage() {
  const { user } = useAuth();
  const canManage = user ? canManageEmployees(user.role) : false;
  const holidayYear = 2026;
  const [holidayMonth, setHolidayMonth] = useState("all");
  const [holidays, setHolidays] = useState<CompanyHoliday[]>(COMPANY_HOLIDAYS_2026);
  const [editor, setEditor] = useState<{
    id?: string;
    date: string;
    name: string;
    type: "leave" | "celebration";
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const groups = MONTH_NAMES.map((month, monthIndex) => ({
    month,
    monthIndex,
    holidays: holidays.filter((holiday) => holidayDateParts(holiday).monthIndex === monthIndex),
  })).filter(
    (group) =>
      group.holidays.length > 0 &&
      (holidayMonth === "all" || group.monthIndex === Number(holidayMonth)),
  );
  const leaveCount = holidays.filter((holiday) => holiday.type === "leave").length;
  const celebrationCount = holidays.length - leaveCount;

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/company-holidays?year=${holidayYear}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await readResponseJson<{
          success?: boolean;
          holidays?: CompanyHoliday[];
          message?: string;
        }>(response, "fetch");
        if (!response.ok || !data.success) {
          throw new Error(data.message ?? "Failed to load company holidays");
        }
        return data.holidays ?? [];
      })
      .then((items) => {
        if (!cancelled) setHolidays(items);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(toUserFacingFetchError(loadError));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [holidayYear]);

  const saveHoliday = async () => {
    if (!editor?.date || !editor.name.trim()) {
      setError("Holiday date and name are required.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/company-holidays", {
        method: editor.id ? "PATCH" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editor.id,
          date: editor.date,
          name: editor.name.trim(),
          type: editor.type,
        }),
      });
      const data = await readResponseJson<{
        success?: boolean;
        message?: string;
        holiday?: CompanyHoliday;
      }>(response, "action");
      if (!response.ok || !data.success || !data.holiday) {
        throw new Error(data.message ?? "Failed to save company holiday");
      }

      setHolidays((current) =>
        [...current.filter((holiday) => holiday.id !== data.holiday?.id), data.holiday!].sort(
          (left, right) => left.date.localeCompare(right.date),
        ),
      );
      setHolidayMonth("all");
      setEditor(null);
    } catch (saveError) {
      setError(toUserFacingActionError(saveError));
    } finally {
      setSaving(false);
    }
  };

  const deleteHoliday = async (holiday: CompanyHoliday) => {
    if (!window.confirm(`Delete ${holiday.name} from the company holiday calendar?`)) return;

    setDeletingId(holiday.id);
    setError(null);
    try {
      const response = await fetch("/api/company-holidays", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: holiday.id }),
      });
      const data = await readResponseJson<{ success?: boolean; message?: string }>(
        response,
        "action",
      );
      if (!response.ok || !data.success) {
        throw new Error(data.message ?? "Failed to delete company holiday");
      }
      setHolidays((current) => current.filter((item) => item.id !== holiday.id));
      setEditor((current) => (current?.id === holiday.id ? null : current));
    } catch (deleteError) {
      setError(toUserFacingActionError(deleteError));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Company Holiday Calendar · ${holidayYear}`}
        description="Official company leave days and workplace celebrations."
        actions={
          canManage ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setError(null);
                setEditor({ date: formatIsoDate(), name: "", type: "leave" });
              }}
            >
              <Plus className="size-4" />
              Add holiday
            </Button>
          ) : undefined
        }
      />

      <Card className="overflow-hidden">
        <CardHeader className="bg-ex-surface/40 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Holiday schedule</CardTitle>
            <p className="text-ex-muted mt-1 text-sm">
              Browse leave days and celebrations by month.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="warning">{leaveCount} leave days</Badge>
            <Badge variant="accent">{celebrationCount} celebrations</Badge>
            <Select
              value={holidayMonth}
              onChange={(event) => setHolidayMonth(event.target.value)}
              className="w-40"
              aria-label="Filter holidays by month"
            >
              <option value="all">All months</option>
              {MONTH_NAMES.map((month, index) => (
                <option key={month} value={index}>
                  {month}
                </option>
              ))}
            </Select>
          </div>
        </CardHeader>

        <CardContent className="space-y-5 p-5">
          {editor ? (
            <div className="border-ex-secondary/25 bg-ex-secondary/5 rounded-xl border p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
                <div className="grid flex-1 gap-4 sm:grid-cols-3">
                  <label className="space-y-1.5">
                    <span className="text-ex-muted text-xs font-medium tracking-wide uppercase">
                      Date
                    </span>
                    <Input
                      type="date"
                      min={`${holidayYear}-01-01`}
                      max={`${holidayYear}-12-31`}
                      value={editor.date}
                      onChange={(event) =>
                        setEditor((current) =>
                          current ? { ...current, date: event.target.value } : current,
                        )
                      }
                    />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-ex-muted text-xs font-medium tracking-wide uppercase">
                      Holiday name
                    </span>
                    <Input
                      value={editor.name}
                      maxLength={120}
                      placeholder="Holiday name"
                      onChange={(event) =>
                        setEditor((current) =>
                          current ? { ...current, name: event.target.value } : current,
                        )
                      }
                    />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-ex-muted text-xs font-medium tracking-wide uppercase">
                      Day type
                    </span>
                    <Select
                      value={editor.type}
                      onChange={(event) =>
                        setEditor((current) =>
                          current
                            ? {
                                ...current,
                                type: event.target.value as "leave" | "celebration",
                              }
                            : current,
                        )
                      }
                    >
                      <option value="leave">Leave</option>
                      <option value="celebration">Celebration</option>
                    </Select>
                  </label>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    disabled={saving}
                    onClick={() => {
                      setEditor(null);
                      setError(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button variant="secondary" disabled={saving} onClick={() => void saveHoliday()}>
                    {saving ? "Saving…" : editor.id ? "Update holiday" : "Add holiday"}
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </p>
          ) : null}

          {groups.length === 0 ? (
            <div className="border-ex-border bg-ex-surface/40 rounded-xl border border-dashed px-6 py-10 text-center">
              <p className="text-ex-primary font-medium">No company holidays this month</p>
              <p className="text-ex-muted mt-1 text-sm">Select another month to view holidays.</p>
            </div>
          ) : (
            <div className="grid min-w-0 items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
              {groups.map((group) => (
                <div
                  key={group.month}
                  className="border-ex-border bg-ex-surface/40 min-w-0 overflow-hidden rounded-xl border p-4"
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <p className="text-ex-primary min-w-0 truncate font-semibold">{group.month}</p>
                    <span className="text-ex-muted shrink-0 text-xs">
                      {group.holidays.length} day{group.holidays.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="min-w-0 space-y-2">
                    {group.holidays.map((holiday) => (
                      <HolidayItem
                        key={holiday.id}
                        holiday={holiday}
                        onEdit={
                          canManage
                            ? (selected) => {
                                setError(null);
                                setEditor(selected);
                              }
                            : undefined
                        }
                        onDelete={
                          canManage ? (selected) => void deleteHoliday(selected) : undefined
                        }
                        deleting={deletingId === holiday.id}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
