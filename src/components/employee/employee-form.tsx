"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  EMPLOYEE_DOCUMENT_FIELDS,
  formToSheetRow,
  initialEmployeeForm,
  maskAadhar,
  maskPan,
  sheetRowToForm,
  type EmployeeFormState,
} from "@/lib/employee";
import { POSITIONS, ROLES } from "@/app/consts/common";
import { useAuth } from "@/contexts/auth-provider";
import { canManageEmployees } from "@/lib/auth/roles";
import { ALL_TECH_SKILLS, joinSkillsValue, parseSkillsValue } from "@/app/consts/tech-skills";
import { Select } from "../ui/select";
import { resolveProfileImageSrc } from "@/lib/employee/documents";
import { type DocumentField, FileUploaderField } from "../ui/file-uploader";
import { IndianPhoneInput } from "../ui/indian-phone-input";
import { MultiSelect } from "../ui/multi-select";
import { DateInput } from "../ui/date-input";
import { FormSkeleton } from "../ui/form-skeleton";

function FormField({
  label,
  id,
  children,
  className,
}: {
  label: string;
  id: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className ?? "space-y-2"}>
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

export type EmployeeFormProps = {
  mode: "add" | "edit";
  sheetRow?: number;
  successRedirectPath?: string;
  cancelHref?: string;
  onSaved?: () => void;
  onCancel?: () => void;
  useOwnProfileEndpoint?: boolean;
};

export function EmployeeForm({
  mode,
  sheetRow,
  successRedirectPath = "/employee",
  cancelHref = "/employee",
  onSaved,
  onCancel,
  useOwnProfileEndpoint = false,
}: EmployeeFormProps) {
  const router = useRouter();
  const { user } = useAuth();
  const canManage = user ? canManageEmployees(user.role) : false;
  const canEditRole = user?.role === ROLES.HR_MANAGER || user?.role === ROLES.SUPER_ADMIN;
  const canEditLastIncrement = user?.role !== ROLES.EMPLOYEE;
  const isEdit = mode === "edit";

  const [form, setForm] = useState<EmployeeFormState>(initialEmployeeForm);
  const [sheetHeaders, setSheetHeaders] = useState<string[]>([]);
  const [loading, setLoading] = useState(isEdit);
  const [headersLoading, setHeadersLoading] = useState(!isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [documentFiles, setDocumentFiles] = useState<Partial<Record<DocumentField, File>>>({});
  const [profileImagePreview, setProfileImagePreview] = useState<string | null>(null);

  const profileImageSrc = resolveProfileImageSrc(form.profileImage, profileImagePreview);

  useEffect(() => {
    return () => {
      if (profileImagePreview?.startsWith("blob:")) {
        URL.revokeObjectURL(profileImagePreview);
      }
    };
  }, [profileImagePreview]);

  const clearProfileImagePreview = () => {
    setProfileImagePreview((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      return null;
    });
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        setError(null);
        clearProfileImagePreview();

        if (isEdit && useOwnProfileEndpoint) {
          const response = await fetch("/api/employee/me");
          const result = await response.json();
          if (cancelled) return;

          if (!result.success) {
            setError(result.message || "Employee not found");
            return;
          }

          const headers = (result.headers as string[]) ?? [];
          setSheetHeaders(headers);
          setForm(sheetRowToForm(headers, (result.row as string[]) ?? []));
          return;
        }

        if (isEdit && sheetRow) {
          const response = await fetch(`/api/employee?row=${sheetRow}`);
          const result = await response.json();
          if (cancelled) return;

          if (!result.success) {
            setError(result.message || "Employee not found");
            return;
          }

          const headers = (result.headers as string[]) ?? [];
          setSheetHeaders(headers);
          setForm(sheetRowToForm(headers, (result.row as string[]) ?? []));
          return;
        }

        const response = await fetch("/api/employee?headersOnly=true");
        const result = await response.json();
        if (cancelled) return;

        if (result.success) {
          const headers = (result.headers as string[]) ?? [];
          if (headers.length === 0) {
            setError("No columns found in the employee sheet.");
          } else {
            setSheetHeaders(headers);
          }
        } else {
          setError(result.message || "Failed to load sheet columns");
        }
      } catch {
        if (!cancelled) {
          setError(isEdit ? "Failed to load employee" : "Failed to load sheet columns");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setHeadersLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isEdit, sheetRow, useOwnProfileEndpoint]);

  const update =
    (field: keyof EmployeeFormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
    };

  const handleFile = (field: DocumentField) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setDocumentFiles((prev) => ({ ...prev, [field]: file }));
    setForm((prev) => ({ ...prev, [field]: file.name }));

    if (field === "profileImage") {
      setProfileImagePreview((prev) => {
        if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
        return file.type.startsWith("image/") ? URL.createObjectURL(file) : null;
      });
    }
  };

  const saveEmployee = async (formData: EmployeeFormState) => {
    if (!sheetHeaders.length) {
      setError("Sheet columns are not loaded yet.");
      return;
    }

    setError(null);
    setSubmitting(true);

    const rowValues = formToSheetRow(formData, sheetHeaders);

    const body = new FormData();
    body.append("values", JSON.stringify([rowValues]));
    if (isEdit && sheetRow) {
      body.append("sheetRow", String(sheetRow));
    }
    for (const field of EMPLOYEE_DOCUMENT_FIELDS) {
      const file = documentFiles[field];
      if (file) body.append(field, file);
    }

    try {
      const response = await fetch("/api/employee", {
        method: isEdit ? "PUT" : "POST",
        body,
      });
      const result = await response.json();

      if (result.success) {
        if (result.documentWarning) {
          setError(result.message || String(result.documentWarning));
          return;
        }

        const credentials = result.credentials as
          | { username?: string; initialPassword?: string }
          | undefined;
        if (!isEdit && credentials && (credentials.username || credentials.initialPassword)) {
          const lines = [
            "Employee saved. Share these sign-in details once (they are stored encrypted in the sheet):",
            credentials.username ? `Username: ${credentials.username}` : null,
            credentials.initialPassword ? `Password: ${credentials.initialPassword}` : null,
          ].filter(Boolean);
          window.alert(lines.join("\n"));
        }

        if (onSaved) {
          onSaved();
        } else {
          router.push(successRedirectPath);
        }
        return;
      }

      setError(result.message || (isEdit ? "Failed to update employee" : "Failed to add employee"));
    } catch {
      setError(
        isEdit
          ? "Failed to update employee. Please try again."
          : "Failed to add employee. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveEmployee(form);
  };

  if (loading) {
    return <FormSkeleton label="Loading employee…" fields={8} />;
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-4 flex flex-col gap-4 xl:flex-row">
        <div className="w-full max-w-3xl space-y-6 xl:w-1/2">
          <Card>
            <CardHeader>
              <CardTitle>Employee details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <FormField label="Name" id="name">
                <Input
                  id="name"
                  value={form.name}
                  onChange={update("name")}
                  placeholder="Employee Full Name"
                  required
                />
              </FormField>

              <FormField label="Role" id="role">
                <Select
                  id="role"
                  value={form.role}
                  onChange={update("role")}
                  disabled={isEdit && !canEditRole}
                  required
                >
                  <option value="">Select Role</option>
                  <option value={ROLES.SUPER_ADMIN}>Super Administrator</option>
                  <option value={ROLES.HR_MANAGER}>HR Manager</option>
                  <option value={ROLES.EMPLOYEE}>Employee</option>
                </Select>
              </FormField>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="address">Address</Label>
                <Textarea
                  id="address"
                  value={form.address}
                  onChange={update("address")}
                  placeholder="Residential address"
                  rows={3}
                />
              </div>

              <FormField label="Birthday date" id="birthdayDate">
                <DateInput
                  id="birthdayDate"
                  value={form.birthdayDate}
                  onChange={(birthdayDate) => setForm((prev) => ({ ...prev, birthdayDate }))}
                  maxYear={new Date().getFullYear()}
                />
              </FormField>
            </CardContent>
          </Card>

          {!isEdit ? (
            <Card>
              <CardHeader>
                <CardTitle>Documents</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <FormField label="PAN number" id="panNumber">
                  <Input
                    id="panNumber"
                    value={form.panNumber}
                    onChange={update("panNumber")}
                    placeholder="AAAAA9999A"
                    autoComplete="off"
                  />
                  {form.panNumber ? (
                    <p className="text-ex-muted text-xs">Displayed as {maskPan(form.panNumber)}</p>
                  ) : null}
                </FormField>

                <FormField label="Aadhaar number" id="aadharNumber">
                  <Input
                    id="aadharNumber"
                    value={form.aadharNumber}
                    onChange={update("aadharNumber")}
                    placeholder="12-digit Aadhaar"
                    inputMode="numeric"
                    autoComplete="off"
                  />
                  {form.aadharNumber ? (
                    <p className="text-ex-muted text-xs">
                      Displayed as {maskAadhar(form.aadharNumber)}
                    </p>
                  ) : null}
                </FormField>

                <FormField label="PAN card (upload)" id="pancard">
                  <FileUploaderField
                    id="pancard"
                    fileName={form.pancard}
                    onChange={handleFile("pancard")}
                  />
                </FormField>

                <FormField label="Aadhaar card (upload)" id="aadharCard">
                  <FileUploaderField
                    id="aadharCard"
                    fileName={form.aadharCard}
                    onChange={handleFile("aadharCard")}
                  />
                </FormField>

                <FormField label="Marksheet" id="marksheet">
                  <FileUploaderField
                    id="marksheet"
                    fileName={form.marksheet}
                    onChange={handleFile("marksheet")}
                  />
                </FormField>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Parent / guardian information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4 grid gap-4 sm:grid-cols-2">
                <FormField label="Parent / Guardian Name" id="parentName">
                  <Input
                    id="parentName"
                    value={form.parentName}
                    onChange={update("parentName")}
                    placeholder="Parent / Guardian Name"
                    required
                  />
                </FormField>
                <FormField label="Parent / Guardian Contact" id="parentContact">
                  <IndianPhoneInput
                    id="parentContact"
                    value={form.parentContact}
                    onChange={(value) => setForm((prev) => ({ ...prev, parentContact: value }))}
                    placeholder="Parent / Guardian Contact"
                    required
                  />
                </FormField>
              </div>
              <FormField label="Parent / Guardian Details" id="parentDetails">
                <Textarea
                  id="parentDetails"
                  value={form.parentDetails}
                  onChange={update("parentDetails")}
                  placeholder="Parent / Guardian Details"
                  required
                />
              </FormField>
            </CardContent>
          </Card>

          {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
        </div>
        <div className="w-full max-w-3xl space-y-6 xl:w-1/2">
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex items-center justify-center">
                {profileImageSrc ? (
                  <Image
                    src={profileImageSrc}
                    alt="Profile"
                    width={96}
                    height={96}
                    unoptimized
                    className="border-ex-border size-24 rounded-full border object-cover"
                  />
                ) : null}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <FormField label="Profile image" id="profileImage">
                    <FileUploaderField
                      id="profileImage"
                      fileName={form.profileImage}
                      onChange={handleFile("profileImage")}
                    />
                  </FormField>
                </div>

                <div className="space-y-2">
                  <FormField label="Postion" id="position">
                    <Select
                      id="position"
                      value={form.position}
                      onChange={update("position")}
                      required
                    >
                      <option value="">Select Position</option>
                      {[
                        { value: POSITIONS.TRAINEE, label: "Trainee" },
                        { value: POSITIONS.FRONTEND_DEVELOPER, label: "Frontend Developer" },
                        {
                          value: POSITIONS.SENIOR_FRONTEND_DEVELOPER,
                          label: "Senior Frontend Developer",
                        },
                        { value: POSITIONS.BACKEND_DEVELOPER, label: "Backend Developer" },
                        {
                          value: POSITIONS.SENIOR_BACKEND_DEVELOPER,
                          label: "Senior Backend Developer",
                        },
                        { value: POSITIONS.FULLSTACK_DEVELOPER, label: "Fullstack Developer" },
                        {
                          value: POSITIONS.SENIOR_FULLSTACK_DEVELOPER,
                          label: "Senior Fullstack Developer",
                        },
                        { value: POSITIONS.HR_MANAGER, label: "HR Manager" },
                        { value: POSITIONS.TEAM_LEAD, label: "Team Lead" },
                        { value: POSITIONS.CEO, label: "CEO" },
                        { value: POSITIONS.OTHER, label: "Other" },
                      ].map((position) => (
                        <option key={position.value} value={position.value}>
                          {position.label}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                </div>

                <div className="space-y-2">
                  <FormField label="Email" id="email">
                    <Input
                      id="email"
                      type="email"
                      value={form.email}
                      onChange={update("email")}
                      placeholder="Work email (used for sign-in)"
                      required
                    />
                  </FormField>
                </div>

                <div className="space-y-2">
                  <FormField label="Username" id="username">
                    <Input
                      id="username"
                      value={form.username}
                      onChange={update("username")}
                      placeholder="Optional sign-in username"
                      autoComplete="off"
                    />
                  </FormField>
                </div>

                <div className="space-y-2">
                  <FormField label="Password" id="password">
                    <PasswordInput
                      id="password"
                      value={form.password}
                      onChange={update("password")}
                      placeholder={
                        isEdit
                          ? "Leave blank to keep current password"
                          : "Leave blank to auto-generate (stored encrypted)"
                      }
                      autoComplete="new-password"
                    />
                    <p className="text-ex-muted text-xs">
                      {isEdit
                        ? "Passwords are stored encrypted in the sheet. Enter a new value only to change it."
                        : "Saved as bcrypt in Google Sheets — never stored as plain text. Leave empty for a secure auto-generated password."}
                    </p>
                  </FormField>
                </div>

                <div className="space-y-2">
                  <FormField label="Contact number" id="contactNumber">
                    <IndianPhoneInput
                      id="contactNumber"
                      value={form.contactNumber}
                      onChange={(value) => setForm((prev) => ({ ...prev, contactNumber: value }))}
                      placeholder="Employee Contact Number"
                    />
                  </FormField>
                </div>

                <div className="space-y-2">
                  <FormField label="Experience" id="experience">
                    <Input
                      id="experience"
                      type="number"
                      value={form.experience}
                      onChange={update("experience")}
                      placeholder="Years of experience"
                    />
                  </FormField>
                </div>

                <div className="space-y-2">
                  <FormField label="Joining date" id="joiningDate">
                    <DateInput
                      id="joiningDate"
                      value={form.joiningDate}
                      onChange={(joiningDate) => setForm((prev) => ({ ...prev, joiningDate }))}
                    />
                  </FormField>
                </div>

                <div className="space-y-2">
                  <FormField label="Last increment date" id="lastIncrementDate">
                    <DateInput
                      id="lastIncrementDate"
                      value={form.lastIncrementDate}
                      onChange={(lastIncrementDate) =>
                        setForm((prev) => ({ ...prev, lastIncrementDate }))
                      }
                      disabled={!canEditLastIncrement}
                    />
                  </FormField>
                </div>

                {canManage ? (
                  <div className="space-y-2 sm:col-span-2">
                    <FormField label="Salary (monthly)" id="salary">
                      <Input
                        id="salary"
                        type="text"
                        inputMode="decimal"
                        value={form.salary}
                        onChange={update("salary")}
                        placeholder="e.g. 50000 or 5,00,000"
                        autoComplete="off"
                      />
                      <p className="text-ex-muted text-xs">
                        Visible only to HR and super admin — stored in the employee sheet.
                      </p>
                    </FormField>
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Skills</CardTitle>
            </CardHeader>
            <CardContent>
              <FormField label="Tech skills" id="skills">
                <MultiSelect
                  id="skills"
                  options={[...ALL_TECH_SKILLS]}
                  value={parseSkillsValue(form.skills)}
                  onChange={(skills) =>
                    setForm((prev) => ({ ...prev, skills: joinSkillsValue(skills) }))
                  }
                  placeholder="Select tech skills"
                />
              </FormField>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={submitting || headersLoading || !sheetHeaders.length}>
          {submitting ? "Saving…" : isEdit ? "Save changes" : "Add employee"}
        </Button>

        {onCancel ? (
          <Button type="button" variant="ghost" disabled={submitting} onClick={onCancel}>
            Cancel
          </Button>
        ) : (
          <Link href={cancelHref}>
            <Button type="button" variant="ghost" disabled={submitting}>
              Cancel
            </Button>
          </Link>
        )}
      </div>
    </form>
  );
}
