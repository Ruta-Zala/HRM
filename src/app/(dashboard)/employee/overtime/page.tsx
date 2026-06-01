"use client";

import { useEffect, useMemo, useState } from "react";

import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-provider";
import {
  fetchOvertimeRequests,
  reviewOvertimeRequest,
  type OvertimeRequestDto,
} from "@/lib/attendance/client";
import { canReviewOvertime } from "@/lib/auth/roles";

function statusVariant(status: OvertimeRequestDto["status"]) {
  if (status === "Approved") return "success" as const;
  if (status === "Rejected") return "danger" as const;
  return "warning" as const;
}

export default function OvertimePage() {
  const { user } = useAuth();
  const canDecide = user ? canReviewOvertime(user.role) : false;
  const [rows, setRows] = useState<OvertimeRequestDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setRows(await fetchOvertimeRequests());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load overtime requests");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await fetchOvertimeRequests();
        if (!cancelled) setRows(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load overtime requests");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function decide(row: OvertimeRequestDto, status: "Approved" | "Rejected") {
    const remarks =
      status === "Rejected"
        ? (window.prompt("Rejection remarks (required):") ?? "")
        : (window.prompt("Approval remarks (optional):") ?? "");
    setActingId(row.id);
    setError(null);
    try {
      await reviewOvertimeRequest(row.id, status, remarks);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to review overtime request");
    } finally {
      setActingId(null);
    }
  }

  const pendingCount = useMemo(() => rows.filter((r) => r.status === "Pending").length, [rows]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Overtime approvals"
        description="Employees submit overtime for approval. HR can review requests, while super admin can approve or reject."
        actions={
          <Badge variant={pendingCount > 0 ? "warning" : "default"}>{pendingCount} pending</Badge>
        }
      />
      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Queue</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <DataTable
            loading={loading}
            rows={rows}
            columns={[
              {
                key: "employeeName",
                header: "Employee",
                render: (r) => (
                  <div>
                    <p className="text-ex-primary font-medium">{r.employeeName}</p>
                    <p className="text-ex-muted text-xs">{r.employeeId}</p>
                  </div>
                ),
              },
              { key: "date", header: "Date" },
              { key: "overtime", header: "OT" },
              {
                key: "comment",
                header: "Employee note",
                render: (r) =>
                  r.comment?.trim() ? (
                    <span className="text-ex-muted line-clamp-2 text-sm" title={r.comment}>
                      {r.comment}
                    </span>
                  ) : (
                    <span className="text-ex-muted">—</span>
                  ),
              },
              {
                key: "status",
                header: "State",
                render: (r) => <Badge variant={statusVariant(r.status)}>{r.status}</Badge>,
              },
              {
                key: "remarks",
                header: "Review remarks",
                render: (r) =>
                  r.remarks?.trim() ? r.remarks : <span className="text-ex-muted">—</span>,
              },
              {
                key: "actions",
                header: "Actions",
                sticky: "right",
                render: (r) =>
                  canDecide && r.status === "Pending" ? (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        disabled={actingId != null}
                        onClick={() => void decide(r, "Approved")}
                      >
                        {actingId === r.id ? "Saving..." : "Approve"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={actingId != null}
                        onClick={() => void decide(r, "Rejected")}
                      >
                        {actingId === r.id ? "Saving..." : "Reject"}
                      </Button>
                    </div>
                  ) : (
                    <span className="text-ex-muted">{canDecide ? "Reviewed" : "View only"}</span>
                  ),
              },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}
