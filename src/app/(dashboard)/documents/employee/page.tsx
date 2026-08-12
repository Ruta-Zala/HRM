"use client";

import { Award, BadgeCheck, FileSignature, TrendingUp } from "lucide-react";

import { PageHeader } from "@/components/ui/page-header";
import { AccessDenied } from "@/components/ui/access-denied";
import { useAuth } from "@/contexts/auth-provider";
import { canManageEmployees } from "@/lib/auth/roles";

import { DocumentTypeCard } from "../_shared/DocumentTypeCard";

export default function EmployeeDocumentsPage() {
  const { user } = useAuth();
  const canManage = user ? canManageEmployees(user.role) : false;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Employee Documents"
        description="Pick a document type to generate for an employee."
      />

      {!canManage ? (
        <AccessDenied description="Document generation is only available to HR and Super Admin." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <DocumentTypeCard
            title="Offer Letter"
            description="Full employment offer with role, salary, and terms."
            href="/documents/employee/offer-letter"
            icon={FileSignature}
          />
          <DocumentTypeCard
            title="Experience Letter"
            description="Confirm tenure and role for a current or former employee."
            href="/documents/employee/experience-letter"
            icon={BadgeCheck}
          />
          <DocumentTypeCard
            title="No Objection Certificate"
            description="Clear documents/dues on exit with a signed acknowledgement."
            href="/documents/employee/noc"
            icon={Award}
          />
          <DocumentTypeCard
            title="Increment Letter"
            description="Notify a salary increment with the revised pay breakdown."
            href="/documents/employee/increment-letter"
            icon={TrendingUp}
          />
        </div>
      )}
    </div>
  );
}
