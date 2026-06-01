"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AttendanceHistoryView } from "@/components/attendance/attendance-history-view";
import { useAuth } from "@/contexts/auth-provider";
import {
  fetchAttendanceHistory,
  fetchAttendancePeriods,
  importAttendanceCsv,
  submitOvertimeRequest,
  type AttendanceHistoryRow,
  type AttendancePeriod,
} from "@/lib/attendance/client";
import { canManageEmployees } from "@/lib/auth/roles";
import { parseEmployeeListApiResponse } from "@/lib/employee/list";
import type { Employee } from "@/types/employee";

function safeFilePart(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9-_]/g, "")
    .toLowerCase();
}

function exportCsv(
  rows: AttendanceHistoryRow[],
  options?: { employeeName?: string; employeeId?: string; month?: number | null; year?: number | null },
) {
  const headers = [
    "Date",
    "Work Mode",
    "Punch In",
    "Punch Out",
    "Break Time",
    "Working Hours",
    "Overtime",
    "Status",
    "Early Leave Reason",
    "Daily Update",
  ];
  const lines = [
    headers.join(","),
    ...rows.map((r) =>
      [
        r.date,
        r.workMode ?? "",
        r.punchIn,
        r.punchOut,
        r.breakTime,
        r.workingHours,
        r.overtime,
        r.status,
        r.earlyLeaveReason ?? "",
        r.dailyUpdate ?? "",
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const employeePart = options?.employeeName
    ? safeFilePart(options.employeeName)
    : "employee";
  const employeeIdPart = options?.employeeId ? safeFilePart(options.employeeId) : "";
  const monthPart =
    options?.year != null && options?.month != null
      ? `${options.year}-${String(options.month).padStart(2, "0")}`
      : "all-months";
  const parts = ["attendance", employeePart, employeeIdPart, monthPart].filter(Boolean);
  a.download = `${parts.join("-")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AttendanceHistoryPage() {
  const { user } = useAuth();
  const isHr = user ? canManageEmployees(user.role) : false;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedSheetRow, setSelectedSheetRow] = useState<number | null>(null);
  const [periods, setPeriods] = useState<AttendancePeriod[]>([]);
  const [year, setYear] = useState<number | null>(null);
  const [month, setMonth] = useState<number | null>(null);
  const [rows, setRows] = useState<AttendanceHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [requestingOvertimeId, setRequestingOvertimeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);

  const targetSheetRow = isHr
    ? selectedSheetRow ?? user?.sheetRow ?? null
    : user?.sheetRow ?? null;

  useEffect(() => {
    if (!user?.sheetRow) return;
    setSelectedSheetRow(user.sheetRow);
  }, [user?.sheetRow]);

  useEffect(() => {
    if (!isHr) return;
    void fetch("/api/employee?pageSize=200", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => setEmployees(parseEmployeeListApiResponse(data)))
      .catch(() => {});
  }, [isHr]);

  const loadPeriods = useCallback(async () => {
    if (targetSheetRow == null) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAttendancePeriods(targetSheetRow);
      setPeriods(data);
      const first = data[0];
      if (first) {
        setYear(first.year);
        const lastMonth = first.months[first.months.length - 1];
        setMonth(lastMonth?.month ?? null);
      } else {
        setYear(null);
        setMonth(null);
        setRows([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load periods");
    } finally {
      setLoading(false);
    }
  }, [targetSheetRow]);

  useEffect(() => {
    void loadPeriods();
  }, [loadPeriods]);

  const loadHistory = useCallback(async () => {
    if (year == null || month == null || targetSheetRow == null) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAttendanceHistory(year, month, targetSheetRow);
      setRows(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load attendance");
    } finally {
      setLoading(false);
    }
  }, [year, month, targetSheetRow]);

  useEffect(() => {
    if (year != null && month != null) {
      void loadHistory();
    }
  }, [loadHistory, year, month]);

  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => b.date.localeCompare(a.date)),
    [rows],
  );
  const selectedEmployee = useMemo(
    () => employees.find((e) => Number(e.sheetRow) === targetSheetRow) ?? null,
    [employees, targetSheetRow],
  );

  async function handleImportFile(file: File) {
    if (targetSheetRow == null) return;
    setImporting(true);
    setImportMessage(null);
    setError(null);
    try {
      const result = await importAttendanceCsv(file, targetSheetRow);
      const extra =
        result.holidaysSkipped > 0
          ? ` (${result.holidaysSkipped} weekend/holiday rows skipped)`
          : "";
      const employeeLabel =
        result.employee?.employeeName ??
        selectedEmployee?.name ??
        (isHr ? `sheet row ${targetSheetRow}` : "your account");
      setImportMessage(`${result.message}${extra} For: ${employeeLabel}.`);
      await loadPeriods();
      if (year != null && month != null) {
        await loadHistory();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleYearChange(y: number) {
    setYear(y);
    const months = periods.find((p) => p.year === y)?.months ?? [];
    setMonth(months[0]?.month ?? null);
  }

  async function handleRequestOvertime(row: AttendanceHistoryRow) {
    const comment = window.prompt("Optional note for approver (press OK to continue):") ?? "";
    setRequestingOvertimeId(row.id);
    setError(null);
    setImportMessage(null);
    try {
      await submitOvertimeRequest({
        date: row.date,
        comment,
        ...(isHr && targetSheetRow != null ? { employeeSheetRow: targetSheetRow } : {}),
      });
      setImportMessage(`Overtime request submitted for ${row.date}.`);
      await loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit overtime request");
    } finally {
      setRequestingOvertimeId(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv,text/plain"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleImportFile(file);
        }}
      />

      <AttendanceHistoryView
        isHr={isHr}
        employees={employees}
        selectedSheetRow={selectedSheetRow}
        onEmployeeChange={setSelectedSheetRow}
        periods={periods}
        year={year}
        month={month}
        onYearChange={handleYearChange}
        onMonthChange={setMonth}
        rows={rows}
        loading={loading}
        importing={importing}
        error={error}
        importMessage={importMessage}
        onImportClick={() => fileInputRef.current?.click()}
        onExport={() =>
          exportCsv(sortedRows, {
            employeeName: selectedEmployee?.name,
            employeeId: selectedEmployee?.employeeId,
            month,
            year,
          })
        }
        canExport={rows.length > 0}
        requestingOvertimeId={requestingOvertimeId}
        onRequestOvertime={(row) => void handleRequestOvertime(row)}
      />
    </div>
  );
}
