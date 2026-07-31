"use client";

import { readResponseJson } from "@/lib/api/read-response-json";
import { useCallback, useEffect, useMemo, useState } from "react";

import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ROLES } from "@/app/consts/common";
import { useAuth } from "@/contexts/auth-provider";
import { toUserFacingActionError, toUserFacingFetchError } from "@/lib/api/user-facing-error";
import { canManageEmployees } from "@/lib/auth/roles";
import { parseEmployeeListApiResponse } from "@/lib/employee";
import type { Column } from "@/types/table";

type SalarySlipRow = {
  id: string;
  slipId: string;
  title: string;
  status: string;
  netPay: string;
  employeeSheetRow: number;
  employeeName?: string;
};

type EmployeeOption = {
  sheetRow: string;
  name: string;
};

type SalaryHistoryRecord = {
  sheetRow: number;
  employeeSheetRow: number;
  employeeName: string;
  effectiveFrom: string;
  effectiveTo: string;
  basic: number;
  loyaltyBonus: number;
  professionalTax: number;
  status: string;
};

type HistoryTableRow = {
  id: string;
  employee: string;
  basic: string;
  effectiveFrom: string;
  effectiveTo: string;
  period: string;
  loyalty: string;
  professionalTax: string;
  status: string;
};

function formatInr(amount: number): string {
  return `Rs. ${Number(amount || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value: string): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "—";
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    const [y, m, d] = raw.slice(0, 10).split("-");
    return `${d}/${m}/${y}`;
  }
  return raw;
}

function statusVariant(status: string) {
  if (status === "Active") return "success" as const;
  return "warning" as const;
}

export default function SalarySlipsPage() {
  const { user } = useAuth();
  const canManage = user ? canManageEmployees(user.role) : false;

  const [slips, setSlips] = useState<SalarySlipRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [historyRecords, setHistoryRecords] = useState<SalaryHistoryRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(String(currentYear));
  const [month, setMonth] = useState("");
  const [targetEmployee, setTargetEmployee] = useState("");
  const [busy, setBusy] = useState(false);

  const [historyEmployeeSheetRow, setHistoryEmployeeSheetRow] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [basic, setBasic] = useState("");
  const [loyaltyBonus, setLoyaltyBonus] = useState("10");
  const [professionalTax, setProfessionalTax] = useState("200");

  const loadSlips = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ mode: "list" });
      if (canManage) {
        if (targetEmployee) params.set("employeeSheetRow", targetEmployee);
        if (year.trim()) params.set("year", year.trim());
        if (month.trim()) params.set("month", month.trim());
      }

      const res = await fetch(`/api/salary-slips?${params.toString()}`, { credentials: "include" });
      const data = await readResponseJson<{
        success?: boolean;
        message?: string;
        [key: string]: unknown;
      }>(res, "fetch");
      if (!data.success) throw new Error(data.message ?? "Failed to load salary slips");
      const rows = (data.slips ?? []) as Array<{
        slipId: string;
        title: string;
        status: string;
        netPay: number;
        employeeSheetRow: number;
        employeeName: string;
      }>;
      setSlips(
        rows.map((r) => ({
          id: r.slipId,
          slipId: r.slipId,
          title: r.title,
          status: r.status,
          netPay: `Rs. ${Number(r.netPay ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
          employeeSheetRow: r.employeeSheetRow,
          employeeName: r.employeeName,
        })),
      );
    } catch (error) {
      console.error(error);
      setSlips([]);
      window.alert(toUserFacingFetchError(error));
    } finally {
      setLoading(false);
    }
  }, [month, targetEmployee, year, canManage]);

  const loadEmployees = useCallback(async () => {
    if (!canManage) return;
    try {
      const res = await fetch("/api/employee?pageSize=200&status=Active", {
        credentials: "include",
      });
      const data = await readResponseJson<{
        success?: boolean;
        message?: string;
        data?: string[][];
        sheetRows?: number[];
      }>(res, "fetch");
      const list = parseEmployeeListApiResponse(data);
      setEmployees(
        list
          .filter((e) => e.role.trim().toLowerCase() !== ROLES.SUPER_ADMIN)
          .map((e) => ({ sheetRow: e.sheetRow, name: `${e.name} (${e.employeeId})` }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
    } catch (error) {
      console.error(error);
      window.alert(toUserFacingFetchError(error));
    }
  }, [canManage]);

  const loadHistory = useCallback(async () => {
    if (!canManage) return;
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/salary-history", {
        credentials: "include",
        cache: "no-store",
      });
      const data = await readResponseJson<{
        success: boolean;
        message?: string;
        records?: SalaryHistoryRecord[];
      }>(res, "fetch");
      if (!data.success) throw new Error(data.message ?? "Failed to load salary history");
      setHistoryRecords(data.records ?? []);
    } catch (error) {
      console.error(error);
      setHistoryRecords([]);
      window.alert(toUserFacingFetchError(error));
    } finally {
      setHistoryLoading(false);
    }
  }, [canManage]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadSlips();
    void loadEmployees();
    void loadHistory();
  }, [loadSlips, loadEmployees, loadHistory]);

  const monthOptions = useMemo(
    () =>
      Array.from({ length: 12 }).map((_, i) => ({
        value: String(i + 1),
        label: new Date(2026, i, 1).toLocaleString("en-IN", { month: "short" }),
      })),
    [],
  );

  const filteredHistoryRecords = useMemo(() => {
    const selected = Number(historyEmployeeSheetRow);
    const rows =
      Number.isInteger(selected) && selected >= 2
        ? historyRecords.filter((r) => r.employeeSheetRow === selected)
        : historyRecords;

    return [...rows]
      .filter((r) => Boolean(r.effectiveFrom) && Number(r.basic) > 0)
      .sort((a, b) => {
        const nameCmp = String(a.employeeName ?? "").localeCompare(String(b.employeeName ?? ""));
        if (nameCmp !== 0) return nameCmp;
        return String(b.effectiveFrom ?? "").localeCompare(String(a.effectiveFrom ?? ""));
      });
  }, [historyEmployeeSheetRow, historyRecords]);

  const historyTableRows: HistoryTableRow[] = useMemo(() => {
    const nameBySheetRow = new Map(employees.map((e) => [Number(e.sheetRow), e.name]));
    return filteredHistoryRecords.map((record, index) => {
      const rosterName = nameBySheetRow.get(record.employeeSheetRow);
      const rawName = String(record.employeeName ?? "").trim();
      const employee =
        rosterName ||
        (rawName && !/^\d{4}-\d{2}-\d{2}/.test(rawName) ? rawName : "") ||
        `Employee #${record.employeeSheetRow}`;

      return {
        id: `${record.sheetRow}-${record.employeeSheetRow}-${record.effectiveFrom}-${index}`,
        employee,
        basic: formatInr(record.basic),
        effectiveFrom: formatDate(record.effectiveFrom),
        effectiveTo: formatDate(record.effectiveTo),
        period: `${formatDate(record.effectiveFrom)} → ${formatDate(record.effectiveTo)}`,
        loyalty: `${Number(record.loyaltyBonus || 0)}%`,
        professionalTax: formatInr(record.professionalTax),
        status: record.status || "Active",
      };
    });
  }, [filteredHistoryRecords, employees]);

  const historyColumns: Column<HistoryTableRow>[] = useMemo(
    () => [
      { key: "employee", header: "Employee", sortable: true },
      { key: "basic", header: "Basic salary" },
      { key: "period", header: "Effective period" },
      { key: "effectiveFrom", header: "Start date" },
      { key: "effectiveTo", header: "End date" },
      { key: "loyalty", header: "Loyalty" },
      { key: "professionalTax", header: "PT" },
      {
        key: "status",
        header: "Status",
        render: (row) => <Badge variant={statusVariant(row.status)}>{row.status}</Badge>,
      },
    ],
    [],
  );

  const generateSlips = async () => {
    if (!year.trim() || !month.trim()) {
      window.alert("Select year and month before generating slips.");
      return;
    }

    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        year: Number(year),
        month: Number(month),
      };
      if (targetEmployee) payload.employeeSheetRow = Number(targetEmployee);
      const res = await fetch("/api/salary-slips?mode=generate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await readResponseJson<{
        success?: boolean;
        message?: string;
        [key: string]: unknown;
      }>(res, "action");
      if (!data.success) throw new Error(data.message ?? "Failed to generate salary slips");
      await loadSlips();
    } catch (error) {
      window.alert(toUserFacingActionError(error));
    } finally {
      setBusy(false);
    }
  };

  const addSalaryHistory = async () => {
    const selectedRow = Number(historyEmployeeSheetRow);
    if (!Number.isInteger(selectedRow) || selectedRow < 2) {
      window.alert("Select an employee first.");
      return;
    }
    if (!effectiveFrom.trim()) {
      window.alert("Select an effective date.");
      return;
    }
    const basicAmount = Number(basic || 0);
    if (!(basicAmount > 0)) {
      window.alert("Enter a basic salary greater than 0.");
      return;
    }

    const employeeLabel =
      employees.find((e) => e.sheetRow === historyEmployeeSheetRow)?.name ?? "This employee";

    const existingActive = historyRecords.filter(
      (record) =>
        record.employeeSheetRow === selectedRow &&
        String(record.status ?? "").toLowerCase() !== "inactive" &&
        Boolean(String(record.effectiveFrom ?? "").trim()),
    );

    if (existingActive.length > 0) {
      const latest = [...existingActive].sort((a, b) =>
        String(b.effectiveFrom).localeCompare(String(a.effectiveFrom)),
      )[0];
      const currentPeriod = `${formatDate(latest.effectiveFrom)} → ${formatDate(latest.effectiveTo)}`;
      const confirmed = window.confirm(
        `${employeeLabel} already has an effective salary of ${formatInr(latest.basic)} ` +
          `(${currentPeriod}).\n\n` +
          `If you save, that current effective salary will be replaced with ` +
          `${formatInr(basicAmount)} starting ${formatDate(effectiveFrom)}.\n\n` +
          `Do you want to continue and update it?`,
      );
      if (!confirmed) return;
    }

    setBusy(true);
    try {
      const employeeName = employees.find((e) => e.sheetRow === historyEmployeeSheetRow)?.name;
      const res = await fetch("/api/salary-history", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeSheetRow: selectedRow,
          employeeName,
          effectiveFrom,
          basic: basicAmount,
          loyaltyBonus: Number(loyaltyBonus || 0),
          professionalTax: Number(professionalTax || 0),
        }),
      });
      const data = await readResponseJson<{
        success?: boolean;
        message?: string;
        [key: string]: unknown;
      }>(res, "action");
      if (!data.success) throw new Error(data.message ?? "Failed to save salary history");
      window.alert("Salary history saved");
      setBasic("");
      setEffectiveFrom("");
      await loadHistory();
    } catch (error) {
      window.alert(toUserFacingActionError(error));
    } finally {
      setBusy(false);
    }
  };

  const deleteSlip = async (slipId: string) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/salary-slips?slipId=${encodeURIComponent(slipId)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await readResponseJson<{
        success?: boolean;
        message?: string;
        [key: string]: unknown;
      }>(res, "action");
      if (!data.success) throw new Error(data.message ?? "Failed to delete slip");
      await loadSlips();
    } catch (error) {
      window.alert(toUserFacingActionError(error));
    } finally {
      setBusy(false);
    }
  };

  const downloadSlip = (slipId: string) => {
    window.open(`/api/salary-slips/download?slipId=${encodeURIComponent(slipId)}`, "_blank");
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Salary Slips"
        description="Pay slips with secure download, month-wise release, and percentage-based deductions."
      />
      {canManage ? (
        <div className="flex flex-wrap items-center gap-4">
          <div className="w-auto min-w-28">
            <Select value={year} onChange={(e) => setYear(e.target.value)}>
              <option value="">All Years</option>
              {Array.from({ length: currentYear - 2020 + 1 }).map((_, idx) => {
                const y = currentYear - idx;
                return (
                  <option key={y} value={String(y)}>
                    {String(y)}
                  </option>
                );
              })}
            </Select>
          </div>
          <div className="w-auto min-w-32">
            <Select value={month} onChange={(e) => setMonth(e.target.value)}>
              <option value="">All Months</option>
              {monthOptions.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-auto min-w-48 flex-1 sm:flex-none">
            <Select value={targetEmployee} onChange={(e) => setTargetEmployee(e.target.value)}>
              <option value="">All Active Employees</option>
              {employees.map((e) => (
                <option key={e.sheetRow} value={e.sheetRow}>
                  {e.name}
                </option>
              ))}
            </Select>
          </div>
          <Button
            variant="outline"
            onClick={generateSlips}
            disabled={busy}
            className="ml-auto"
            style={{ maxWidth: "180px", justifySelf: "end" }}
          >
            {busy ? "Working..." : "Generate & Release"}
          </Button>
        </div>
      ) : null}

      <Card>
        <CardContent className="p-0">
          <DataTable
            loading={loading}
            rows={slips}
            columns={[
              { key: "title", header: "Pay period" },
              ...(canManage ? [{ key: "employeeName" as const, header: "Employee name" }] : []),
              { key: "netPay", header: "Net pay" },
              { key: "status", header: "Status" },
              {
                key: "slipId",
                header: "Actions",
                render: (row) => (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => downloadSlip(row.slipId)}>
                      Download
                    </Button>
                    {canManage ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600"
                        onClick={() => deleteSlip(row.slipId)}
                      >
                        Delete
                      </Button>
                    ) : null}
                  </div>
                ),
              },
            ]}
          />
        </CardContent>
      </Card>

      {canManage ? (
        <Card>
          <CardContent className="space-y-4 p-4">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold">Salary History (Effective Dated)</h3>
              <p className="text-ex-muted text-xs">
                All employees&apos; effective salary periods are listed below. Select an employee to
                filter that list and to add a new revision (replaces their current effective
                salary).
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <div>
                <p className="text-ex-muted mt-1.5 max-w-sm text-sm leading-relaxed">
                  Select Employee
                </p>
                <Select
                  value={historyEmployeeSheetRow}
                  onChange={(e) => setHistoryEmployeeSheetRow(e.target.value)}
                >
                  <option value="">All</option>
                  {employees.map((e) => (
                    <option key={e.sheetRow} value={e.sheetRow}>
                      {e.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <p className="text-ex-muted mt-1.5 max-w-sm text-sm leading-relaxed">
                  Salary effective date for the next 12 months.
                </p>
                <Input
                  type="date"
                  value={effectiveFrom}
                  onChange={(e) => setEffectiveFrom(e.target.value)}
                  disabled={!historyEmployeeSheetRow}
                />
              </div>
              <div>
                <p className="text-ex-muted mt-1.5 max-w-sm text-sm leading-relaxed">
                  Basic Salary (Rs.)
                </p>
                <Input
                  value={basic}
                  onChange={(e) => setBasic(e.target.value)}
                  placeholder="Basic"
                  disabled={!historyEmployeeSheetRow}
                />
              </div>
              <div>
                <p className="text-ex-muted mt-1.5 max-w-sm text-sm leading-relaxed">
                  Loyalty bonus as a percentage of basic salary.
                </p>
                <Select
                  value={loyaltyBonus}
                  onChange={(e) => setLoyaltyBonus(e.target.value)}
                  disabled={!historyEmployeeSheetRow}
                >
                  <option value="5">Loyalty bonus 5%</option>
                  <option value="10">Loyalty bonus 10%</option>
                  <option value="15">Loyalty bonus 15%</option>
                  <option value="20">Loyalty bonus 20%</option>
                </Select>
              </div>

              <div>
                <p className="text-ex-muted mt-1.5 max-w-sm text-sm leading-relaxed">
                  Professional Tax
                </p>

                <Input
                  value={professionalTax}
                  onChange={(e) => setProfessionalTax(e.target.value)}
                  placeholder="Professional Tax"
                  disabled={!historyEmployeeSheetRow}
                />
              </div>
            </div>
            <Button
              onClick={() => void addSalaryHistory()}
              disabled={busy || !historyEmployeeSheetRow || !effectiveFrom || !basic}
            >
              Save salary revision
            </Button>

            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-ex-primary text-sm font-medium">
                  {historyEmployeeSheetRow
                    ? "Effective Salary For Selected Employee"
                    : "Effective Salary For All Employees"}
                </h4>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={historyLoading || busy}
                  onClick={() => void loadHistory()}
                >
                  <RefreshCw className={`size-4 ${historyLoading ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>
              <DataTable
                loading={historyLoading}
                columns={historyColumns}
                rows={historyTableRows}
                emptyTitle="No salary history"
                emptyDescription={
                  historyEmployeeSheetRow
                    ? "No effective salary records for this employee yet."
                    : "Save a salary revision to see effective periods here."
                }
              />
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
