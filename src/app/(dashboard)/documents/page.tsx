"use client";

import { GraduationCap, Users } from "lucide-react";

import { PageHeader } from "@/components/ui/page-header";
import { AccessDenied } from "@/components/ui/access-denied";
import { useAuth } from "@/contexts/auth-provider";
import { canManageEmployees } from "@/lib/auth/roles";

import { DocumentTypeCard } from "./_shared/DocumentTypeCard";

export default function DocumentsHubPage() {
  const { user } = useAuth();
  const canManage = user ? canManageEmployees(user.role) : false;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Documents"
        description="Generate print-ready letters and certificates for interns and employees."
      />

      {!canManage ? (
        <AccessDenied description="Document generation is only available to HR and Super Admin." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <DocumentTypeCard
            title="Internship"
            description="Internship offer letters and completion certificates for interns."
            href="/documents/internship"
            icon={GraduationCap}
          />
          <DocumentTypeCard
            title="Employee Documents"
            description="Offer, experience, NOC, and joining letters for employees."
            href="/documents/employee"
            icon={Users}
          />
        </div>
      )}
    </div>
  );
}
