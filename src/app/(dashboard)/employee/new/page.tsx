"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/ui/page-header";
import { AccessDenied } from "@/components/ui/access-denied";
import { Button } from "@/components/ui/button";
import { EmployeeForm } from "@/components/employee/employee-form";
import { useAuth } from "@/contexts/auth-provider";
import { ROLES } from "@/app/consts/common";

export default function AddEmployeePage() {
  const { user, loading: authLoading } = useAuth();

  const canManage = user?.role === ROLES.HR_MANAGER || user?.role === ROLES.SUPER_ADMIN;

  if (authLoading) {
    return null;
  }

  if (!canManage) {
    return (
      <div className="space-y-8">
        <PageHeader
          title="Add employee"
          description="Enter employee details to create a new record."
        />
        <AccessDenied
          description="Only HR and Super Admin roles can add employees."
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
        title="Add employee"
        description="Enter employee details to create a new record."
        actions={
          <Link href="/employee">
            <Button variant="outline" size="sm">
              <ArrowLeft className="size-4" />
              Back to directory
            </Button>
          </Link>
        }
      />

      <EmployeeForm mode="add" />
    </div>
  );
}
