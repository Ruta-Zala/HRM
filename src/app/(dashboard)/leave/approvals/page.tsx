"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type LeaveApprovalRow = {
  id: string;
  employeeId: string;
  employeeName: string;
  attendanceSpreadsheetId: string;
  leaveType: string;
  date: string;
  duration: string;
  reason: string;
  status: string;
  rejectReason: string;
  rowIndex: number;
};

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

function statusBadgeVariant(status: string): "default" | "success" | "warning" | "danger" {
  const normalized = status.trim().toLowerCase();
  if (normalized === "accepted") return "success";
  if (normalized === "applied") return "warning";
  if (normalized === "rejected") return "danger";
  return "default";
}

export default function LeaveApprovalsPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<LeaveApprovalRow[]>([]);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectingRow, setRejectingRow] = useState<LeaveApprovalRow | null>(null);

  const loadApprovals = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/employee/leaves/approvals?status=Applied");
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.message ?? "Failed to load approvals");
      }

      setRows(data.applications ?? []);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Failed to load approvals");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadApprovals();
  }, [loadApprovals]);

  const reviewApplication = async (
    row: LeaveApprovalRow,
    status: "Accepted" | "Rejected",
    reason = "",
  ) => {
    setReviewingId(row.id);
    try {
      const res = await fetch("/api/employee/leaves/review", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attendanceSpreadsheetId: row.attendanceSpreadsheetId,
          rowIndex: row.rowIndex,
          leaveType: row.leaveType,
          status,
          rejectReason: reason,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.message ?? "Failed to review leave");
      }

      setRejectingRow(null);
      setRejectReason("");
      await loadApprovals();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Failed to review leave");
    } finally {
      setReviewingId(null);
    }
  };

  const submitReject = async () => {
    if (!rejectingRow) return;
    if (!rejectReason.trim()) {
      window.alert("Please provide a reject reason");
      return;
    }
    await reviewApplication(rejectingRow, "Rejected", rejectReason.trim());
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Approval chain"
        description="Review pending leave applications. Accepting confirms the leave; rejecting requires a reason and frees the quota slot."
        actions={
          <Button variant="outline" onClick={() => void loadApprovals()} disabled={loading}>
            Refresh
          </Button>
        }
      />

      {rejectingRow ? (
        <div className="border-ex-border bg-ex-elevated space-y-3 rounded-xl border p-4">
          <p className="text-sm font-medium">
            Reject {rejectingRow.employeeName}&apos;s {formatLeaveTypeLabel(rejectingRow.leaveType)}{" "}
            leave ({rejectingRow.date})
          </p>
          <Textarea
            rows={3}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Reason for rejection"
          />
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setRejectingRow(null);
                setRejectReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="secondary"
              onClick={() => void submitReject()}
              disabled={reviewingId === rejectingRow.id}
            >
              {reviewingId === rejectingRow.id ? "Rejecting..." : "Confirm reject"}
            </Button>
          </div>
        </div>
      ) : null}

      <DataTable
        loading={loading}
        rows={rows}
        emptyTitle="No pending leave requests"
        emptyDescription="Applied leave requests from all employees will appear here for HR review."
        columns={[
          { key: "employeeName", header: "Employee" },
          {
            key: "leaveType",
            header: "Request",
            render: (r) => {
              const typeLabel = formatLeaveTypeLabel(r.leaveType);
              const duration = r.duration ? ` · ${r.duration}` : "";
              return `${typeLabel}${duration} · ${r.date}`;
            },
          },
          {
            key: "reason",
            header: "Reason",
            render: (r) => r.reason || "—",
          },
          {
            key: "status",
            header: "State",
            render: (r) => (
              <Badge variant={statusBadgeVariant(r.status)}>{r.status || "Pending"}</Badge>
            ),
          },
          {
            key: "id",
            header: "Actions",
            render: (r) => (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={reviewingId === r.id}
                  onClick={() => void reviewApplication(r, "Accepted")}
                >
                  {reviewingId === r.id ? "..." : "Accept"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={reviewingId === r.id}
                  onClick={() => {
                    setRejectingRow(r);
                    setRejectReason("");
                  }}
                >
                  Reject
                </Button>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
