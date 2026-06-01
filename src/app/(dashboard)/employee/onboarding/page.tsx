"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { UserMinus, UserPlus } from "lucide-react";

import { ROLES } from "@/app/consts/common";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DateInput } from "@/components/ui/date-input";
import { useAuth } from "@/contexts/auth-provider";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchEmployeeList,
  formatEmployeeRole,
  isEmployeeInactive,
  offboardEmployee,
  selectEmployeeListError,
  selectEmployeeListLoading,
  selectEmployeeOffboarding,
  selectOffboardingEmployeeOptions,
} from "@/store/slices/employee-list-slice";

function formatEmployeeOptionLabel(name: string, employeeId: string, role: string): string {
  const idPart = employeeId ? ` (${employeeId})` : "";
  const rolePart = role ? ` — ${formatEmployeeRole(role)}` : "";
  return `${name}${idPart}${rolePart}`;
}

export default function OnboardingPage() {
  const { user } = useAuth();
  const dispatch = useAppDispatch();
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [lastWorkingDay, setLastWorkingDay] = useState("");
  const [reason, setReason] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loading = useAppSelector(selectEmployeeListLoading);
  const offboarding = useAppSelector(selectEmployeeOffboarding);
  const listError = useAppSelector(selectEmployeeListError);
  const employees = useAppSelector((state) => selectOffboardingEmployeeOptions(state, user?.role));

  const canViewInactive = user?.role === ROLES.HR_MANAGER || user?.role === ROLES.SUPER_ADMIN;

  const { activeEmployees, inactiveEmployees } = useMemo(() => {
    const active = employees.filter((e) => !isEmployeeInactive(e.status));
    const inactive = canViewInactive ? employees.filter((e) => isEmployeeInactive(e.status)) : [];
    return { activeEmployees: active, inactiveEmployees: inactive };
  }, [employees, canViewInactive]);

  useEffect(() => {
    void dispatch(fetchEmployeeList());
  }, [dispatch]);

  const handleOffboard = async () => {
    setFormError(null);
    setSuccessMessage(null);

    if (!selectedEmployee) {
      setFormError("Please select an employee.");
      return;
    }
    if (!lastWorkingDay.trim()) {
      setFormError("Last working day is required.");
      return;
    }
    if (!reason.trim()) {
      setFormError("Offboarding reason is required.");
      return;
    }

    try {
      await dispatch(
        offboardEmployee({
          sheetRow: selectedEmployee,
          lastWorkingDay: lastWorkingDay.trim(),
          reason: reason.trim(),
        }),
      ).unwrap();

      setSuccessMessage("Employee offboarded and marked inactive.");
      setSelectedEmployee("");
      setLastWorkingDay("");
      setReason("");
      void dispatch(fetchEmployeeList());
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to offboard employee.");
    }
  };

  const isBusy = loading || offboarding;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Onboarding & offboarding"
        description="Checklists, asset assignments, and exit interviews. Hook these steps to Google Drive document packs and Slack channels."
        actions={
          <Link href="/employee/new">
            <Button size="sm">
              <UserPlus className="size-4" />
              Add employee
            </Button>
          </Link>
        }
      />
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Offboarding</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="offboard-employee">Employee</Label>
            <Select
              id="offboard-employee"
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              disabled={isBusy}
            >
              <option value="" disabled>
                {loading ? "Loading employees…" : "Select employee"}
              </option>
              {activeEmployees.map((employee) => (
                <option key={employee.sheetRow} value={employee.sheetRow}>
                  {formatEmployeeOptionLabel(employee.name, employee.employeeId, employee.role)}
                </option>
              ))}
              {inactiveEmployees.length > 0 ? (
                <optgroup label="Inactive">
                  {inactiveEmployees.map((employee) => (
                    <option
                      key={employee.sheetRow}
                      value={employee.sheetRow}
                      disabled
                      title="This user is inactive"
                    >
                      {formatEmployeeOptionLabel(
                        employee.name,
                        employee.employeeId,
                        employee.role,
                      )}{" "}
                    </option>
                  ))}
                </optgroup>
              ) : null}
            </Select>
            {listError ? (
              <p className="text-sm text-red-600 dark:text-red-400">{listError}</p>
            ) : null}
            {!loading && !listError && employees.length === 0 ? (
              <p className="text-ex-muted text-sm">No employees found.</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="last-working-day">Last working day</Label>
            <DateInput
              id="last-working-day"
              value={lastWorkingDay}
              onChange={setLastWorkingDay}
              maxYear={new Date().getFullYear() + 1}
              disabled={isBusy}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="offboard-reason">Reason</Label>
            <Textarea
              id="offboard-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason for leaving, handover notes, etc."
              rows={4}
              disabled={isBusy}
              required
            />
          </div>
          {formError ? <p className="text-sm text-red-600 dark:text-red-400">{formError}</p> : null}
          {successMessage ? (
            <p className="text-sm text-green-700 dark:text-green-400">{successMessage}</p>
          ) : null}
          <Button
            type="button"
            className="w-full sm:w-auto"
            disabled={isBusy || activeEmployees.length === 0}
            onClick={() => void handleOffboard()}
          >
            <UserMinus className="size-4" />
            {offboarding ? "Offboarding…" : "Off board"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
