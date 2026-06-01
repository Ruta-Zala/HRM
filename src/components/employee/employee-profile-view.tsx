"use client";

import { ExternalLink, Pencil, User } from "lucide-react";
import Image from "next/image";

import { ROLES } from "@/app/consts/common";
import { parseSkillsValue } from "@/app/consts/tech-skills";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { normalizeDateValue } from "@/components/ui/date-input";
import { ProfileAccountSettings } from "@/components/employee/profile-account-settings";
import { useAuth } from "@/contexts/auth-provider";
import { canManageEmployees } from "@/lib/auth/roles";
import {
  getDocumentDisplayName,
  getDocumentHref,
  maskAadhar,
  maskPan,
  isEmployeeStatusActive,
  resolveProfileImageSrc,
  type EmployeeDocumentField,
  type EmployeeFormState,
} from "@/lib/employee";

function formatRole(role: string): string {
  if (!role) return "—";
  return role.split("_").join(" ");
}

function formatPosition(position: string): string {
  if (!position) return "—";
  return position.split("_").join(" ");
}

function formatDate(value: string): string {
  const iso = normalizeDateValue(value);
  if (!iso) return "—";
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  return value || "—";
}

function DocumentFileRow({
  label,
  field,
  storedValue,
}: {
  label: string;
  field: EmployeeDocumentField;
  storedValue: string;
}) {
  const title = getDocumentDisplayName(field, storedValue) || "—";
  const href = getDocumentHref(storedValue);

  return (
    <p className="flex justify-between gap-2">
      <span className="text-ex-muted">{label}</span>
      {href && title !== "—" ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-ex-secondary inline-flex items-center gap-1 hover:underline"
        >
          {title}
          <ExternalLink className="size-3.5 shrink-0 opacity-80" aria-hidden />
        </a>
      ) : (
        <span className="text-ex-primary">{title}</span>
      )}
    </p>
  );
}

function ReadOnlyField({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className ?? "space-y-2"}>
      <Label>{label}</Label>
      <Input value={value} readOnly disabled className="disabled:opacity-100" />
    </div>
  );
}

export type EmployeeProfileViewProps = {
  form: EmployeeFormState;
  /** Show sign-in username and password settings (own profile only). */
  showAccountSettings?: boolean;
  hasPassword?: boolean;
  onEdit?: () => void;
  onPasswordUpdated?: () => void;
};

export function EmployeeProfileView({
  form,
  showAccountSettings = false,
  hasPassword: initialHasPassword = false,
  onEdit,
  onPasswordUpdated,
}: EmployeeProfileViewProps) {
  const { user } = useAuth();
  const profileSrc = resolveProfileImageSrc(form.profileImage);
  const skills = parseSkillsValue(form.skills);
  const showDocuments = user?.role === ROLES.HR_MANAGER || user?.role === ROLES.SUPER_ADMIN;
  const canManage = user ? canManageEmployees(user.role) : false;
  const isInactive = !isEmployeeStatusActive(form.status);

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <div className="space-y-4 xl:col-span-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>Core details</CardTitle>
              {onEdit ? (
                <Button variant="outline" size="sm" type="button" onClick={onEdit}>
                  <Pencil className="size-4" />
                  Edit profile
                </Button>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col items-center gap-3 sm:col-span-2">
              {profileSrc ? (
                <Image
                  src={profileSrc}
                  alt="Profile"
                  width={96}
                  height={96}
                  unoptimized
                  className="border-ex-border size-24 rounded-full border object-cover"
                />
              ) : (
                <span
                  className="border-ex-border bg-ex-surface text-ex-muted inline-flex size-24 items-center justify-center rounded-full border"
                  aria-hidden
                >
                  <User className="size-10" />
                </span>
              )}
              <div className="text-center">
                <p className="text-ex-primary text-lg font-semibold">{form.name || "—"}</p>
                <p className="text-ex-muted text-sm">{form.employeeId || "—"}</p>
              </div>
            </div>

            <ReadOnlyField label="Email" value={form.email || "—"} />
            <ReadOnlyField label="Username" value={form.username || "—"} />
            <ReadOnlyField label="Contact" value={formatPhone(form.contactNumber)} />
            <ReadOnlyField label="Role" value={formatRole(form.role)} />
            <ReadOnlyField label="Position" value={formatPosition(form.position)} />

            {isInactive ? (
              <>
                <ReadOnlyField label="Last working day" value={formatDate(form.lastWorkingDay)} />
                <div className="space-y-2 sm:col-span-2">
                  <Label>Offboard reason</Label>
                  <Textarea
                    value={form.offboardReason || "—"}
                    readOnly
                    disabled
                    rows={3}
                    className="disabled:opacity-100"
                  />
                </div>
              </>
            ) : null}

            <div className="space-y-2 sm:col-span-2">
              <Label>Address</Label>
              <Textarea
                value={form.address || "—"}
                readOnly
                disabled
                rows={3}
                className="disabled:opacity-100"
              />
            </div>

            <ReadOnlyField label="Birthday" value={formatDate(form.birthdayDate)} />
            <ReadOnlyField label="Joining date" value={formatDate(form.joiningDate)} />
            <ReadOnlyField label="Last increment" value={formatDate(form.lastIncrementDate)} />
            <ReadOnlyField label="Experience (years)" value={form.experience || "—"} />

            {canManage ? (
              <ReadOnlyField
                label="Salary (monthly)"
                value={form.salary?.trim() ? form.salary : "—"}
              />
            ) : null}

            <ReadOnlyField label="PAN" value={maskPan(form.panNumber)} />
            <ReadOnlyField label="Aadhaar" value={maskAadhar(form.aadharNumber)} />
          </CardContent>
        </Card>

        {showAccountSettings ? (
          <ProfileAccountSettings
            username={form.username}
            hasPassword={initialHasPassword}
            onPasswordUpdated={onPasswordUpdated}
          />
        ) : null}
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Family</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ReadOnlyField label="Parent / guardian" value={form.parentName || "—"} />
            <ReadOnlyField label="Guardian contact" value={formatPhone(form.parentContact)} />
            <div className="space-y-2">
              <Label>Guardian details</Label>
              <Textarea
                value={form.parentDetails || "—"}
                readOnly
                disabled
                rows={3}
                className="disabled:opacity-100"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Skills</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Tech skills</Label>
              <Textarea
                value={skills.length ? skills.join(", ") : "—"}
                readOnly
                disabled
                rows={4}
                className="disabled:opacity-100"
              />
            </div>
          </CardContent>
        </Card>

        {showDocuments ? (
          <Card>
            <CardHeader>
              <CardTitle>Documents on file</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <DocumentFileRow label="PAN card" field="pancard" storedValue={form.pancard} />
              <DocumentFileRow
                label="Aadhaar card"
                field="aadharCard"
                storedValue={form.aadharCard}
              />
              <DocumentFileRow label="Marksheet" field="marksheet" storedValue={form.marksheet} />
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
