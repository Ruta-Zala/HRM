"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/auth-provider";
import { canManageEmployees } from "@/lib/auth/roles";
import { parseEmployeeListApiResponse } from "@/lib/employee";

type SalarySlipRow = {
  id: string;
  slipId: string;
  title: string;
  status: string;
  netPay: string;
  employeeSheetRow: number;
};

type EmployeeOption = {
  sheetRow: string;
  name: string;
};

export default function SalarySlipsPage() {
  const { user } = useAuth();
  const canManage = user ? canManageEmployees(user.role) : false;

  const [slips, setSlips] = useState<SalarySlipRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
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
      const data = await res.json();
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
    } finally {
      setLoading(false);
    }
  }, [month, targetEmployee, year, canManage]);

  const loadEmployees = useCallback(async () => {
    if (!canManage) return;
    const res = await fetch("/api/employee?pageSize=100", { credentials: "include" });
    const data = await res.json();
    const list = parseEmployeeListApiResponse(data);
    setEmployees(list.map((e) => ({ sheetRow: e.sheetRow, name: `${e.name} (${e.employeeId})` })));
  }, [canManage]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadSlips();
    void loadEmployees();
  }, [loadSlips, loadEmployees]);

  const monthOptions = useMemo(
    () =>
      Array.from({ length: 12 }).map((_, i) => ({
        value: String(i + 1),
        label: new Date(2026, i, 1).toLocaleString("en-IN", { month: "short" }),
      })),
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
      const data = await res.json();
      if (!data.success) throw new Error(data.message ?? "Failed to generate salary slips");
      await loadSlips();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Failed to generate salary slips");
    } finally {
      setBusy(false);
    }
  };

  const addSalaryHistory = async () => {
    setBusy(true);
    try {
      const employeeName = employees.find((e) => e.sheetRow === historyEmployeeSheetRow)?.name;
      const res = await fetch("/api/salary-history", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeSheetRow: Number(historyEmployeeSheetRow),
          employeeName,
          effectiveFrom,
          basic: Number(basic || 0),
          loyaltyBonus: Number(loyaltyBonus || 0),
          professionalTax: Number(professionalTax || 0),
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message ?? "Failed to save salary history");
      window.alert("Salary history saved");
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Failed to save salary history");
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
      const data = await res.json();
      if (!data.success) throw new Error(data.message ?? "Failed to delete slip");
      await loadSlips();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Failed to delete slip");
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
        title="Salary slips"
        description="Pay slips with secure download, month-wise release, and percentage-based deductions."
      />
      {canManage ? (
        <div className="flex items-center gap-4">
          <select
            className="border-ex-border bg-ex-surface rounded-md border px-3 py-2"
            value={year}
            onChange={(e) => setYear(e.target.value)}
          >
            <option value="">All years</option>
            {Array.from({ length: currentYear - 2020 + 1 }).map((_, idx) => {
              const y = currentYear - idx;
              return (
                <option key={y} value={String(y)}>
                  {String(y)}
                </option>
              );
            })}
          </select>
          <select
            className="border-ex-border bg-ex-surface rounded-md border px-3 py-2"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          >
            <option value="">All months</option>
            {monthOptions.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <select
            className="border-ex-border bg-ex-surface rounded-md border px-3 py-2"
            value={targetEmployee}
            onChange={(e) => setTargetEmployee(e.target.value)}
          >
            <option value="">All active employees</option>
            {employees.map((e) => (
              <option key={e.sheetRow} value={e.sheetRow}>
                {e.name}
              </option>
            ))}
          </select>
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
          <CardContent className="space-y-3 p-4">
            <h3 className="text-sm font-semibold">Salary history (effective-dated)</h3>
            <div className="grid gap-3 md:grid-cols-4">
              <div>
                <p className="text-ex-muted mt-1.5 max-w-sm text-sm leading-relaxed">
                  Select employee
                </p>
                <select
                  className="border-ex-border bg-ex-surface w-full rounded-md border px-3 py-2"
                  value={historyEmployeeSheetRow}
                  onChange={(e) => setHistoryEmployeeSheetRow(e.target.value)}
                >
                  <option value="">Select employee</option>
                  {employees.map((e) => (
                    <option key={e.sheetRow} value={e.sheetRow}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <p className="text-ex-muted mt-1.5 max-w-sm text-sm leading-relaxed">
                  Salary effective date for the next 12 months.
                </p>
                <Input
                  type="date"
                  value={effectiveFrom}
                  onChange={(e) => setEffectiveFrom(e.target.value)}
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
                />
              </div>
              <div>
                <p className="text-ex-muted mt-1.5 max-w-sm text-sm leading-relaxed">
                  Loyalty bonus as a percentage of basic salary.
                </p>
                <select
                  className="border-ex-border bg-ex-surface w-full rounded-md border px-3 py-2"
                  value={loyaltyBonus}
                  onChange={(e) => setLoyaltyBonus(e.target.value)}
                >
                  <option value="5">Loyalty bonus 5%</option>
                  <option value="10">Loyalty bonus 10%</option>
                  <option value="15">Loyalty bonus 15%</option>
                  <option value="20">Loyalty bonus 20%</option>
                </select>
              </div>

              <div>
                <p className="text-ex-muted mt-1.5 max-w-sm text-sm leading-relaxed">
                  Professional Tax
                </p>

                <Input
                  value={professionalTax}
                  onChange={(e) => setProfessionalTax(e.target.value)}
                  placeholder="Professional Tax"
                />
              </div>
            </div>
            <Button
              onClick={addSalaryHistory}
              disabled={busy || !historyEmployeeSheetRow || !effectiveFrom}
            >
              Save salary revision
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
