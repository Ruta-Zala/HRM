"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";

import { ROLES } from "@/app/consts/common";
import { PageHeader } from "@/components/ui/page-header";
import { AccessDenied } from "@/components/ui/access-denied";
import { Button } from "@/components/ui/button";
import { FormSkeleton } from "@/components/ui/form-skeleton";
import { EmployeeProfileView } from "@/components/employee/employee-profile-view";
import { useAuth } from "@/contexts/auth-provider";
import { sheetRowToForm, type EmployeeFormState } from "@/lib/employee";

export default function EmployeeProfileByRowPage() {
  const router = useRouter();
  const params = useParams();
  const { user, loading: authLoading } = useAuth();
  const [form, setForm] = useState<EmployeeFormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const sheetRow = Number(params.sheetRow);
  const validRow = Number.isFinite(sheetRow) && sheetRow >= 2;
  const canManage = user?.role === ROLES.HR_MANAGER || user?.role === ROLES.SUPER_ADMIN;

  useEffect(() => {
    if (authLoading) return;
    if (!canManage) {
      router.replace("/employee/profile");
      return;
    }
    if (!validRow) {
      router.replace("/employee");
    }
  }, [authLoading, canManage, router, validRow]);

  useEffect(() => {
    if (authLoading || !canManage || !validRow) return;

    const loadProfile = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`/api/employee?row=${sheetRow}`);
        const result = await response.json();

        if (!result.success) {
          setError(result.message ?? "Employee not found.");
          return;
        }

        const headers = (result.headers as string[]) ?? [];
        setForm(sheetRowToForm(headers, (result.row as string[]) ?? []));
      } catch {
        setError("Failed to load employee profile.");
      } finally {
        setLoading(false);
      }
    };

    void loadProfile();
  }, [authLoading, canManage, sheetRow, validRow]);

  if (authLoading || !canManage || !validRow) {
    return null;
  }

  if (loading) {
    return (
      <div className="space-y-8">
        <PageHeader title="Employee profile" description="Loading employee record…" />
        <FormSkeleton label="Loading profile…" fields={8} />
      </div>
    );
  }

  if (error || !form) {
    return (
      <div className="space-y-8">
        <PageHeader title="Employee profile" />
        <AccessDenied
          title="Profile unavailable"
          description={error ?? "Employee not found."}
          action={
            <Link href="/employee">
              <Button variant="outline" size="sm">
                <ArrowLeft className="size-4" />
                Back to directory
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Employee profile"
        description={`Viewing ${form.name || "employee"} (${form.employeeId || sheetRow}).`}
        actions={
          <>
            <Link href="/employee">
              <Button variant="outline" size="sm">
                <ArrowLeft className="size-4" />
                Back to directory
              </Button>
            </Link>
            <Link href={`/employee/${sheetRow}/edit`}>
              <Button size="sm">
                <Pencil className="size-4" />
                Edit
              </Button>
            </Link>
          </>
        }
      />
      <EmployeeProfileView form={form} />
    </div>
  );
}
