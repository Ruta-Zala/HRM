"use client";

import { Award, FileSignature } from "lucide-react";

import { PageHeader } from "@/components/ui/page-header";
import { AccessDenied } from "@/components/ui/access-denied";
import { useAuth } from "@/contexts/auth-provider";
import { canManageEmployees } from "@/lib/auth/roles";

import { DocumentTypeCard } from "../_shared/DocumentTypeCard";

export default function InternshipDocumentsPage() {
  const { user } = useAuth();
  const canManage = user ? canManageEmployees(user.role) : false;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Internship"
        description="Pick a document type to generate for an intern."
      />

      {!canManage ? (
        <AccessDenied description="Document generation is only available to HR and Super Admin." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <DocumentTypeCard
            title="Internship Offer Letter"
            description="Offer an internship with position, duration, and acceptance deadline."
            href="/documents/internship/offer-letter"
            icon={FileSignature}
          />
          <DocumentTypeCard
            title="Internship Certificate"
            description="Certify a completed internship with the intern's project/technology."
            href="/documents/internship/certificate"
            icon={Award}
          />
        </div>
      )}
    </div>
  );
}
