"use client";

import { useEffect, useMemo, useState } from "react";
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
  BANK_ACCOUNT_MAX_LENGTH,
  BANK_ACCOUNT_MIN_LENGTH,
  EMPLOYEE_DOCUMENT_FIELDS,
  EMPLOYEE_MAX_EXPERIENCE_YEARS,
  firstEmployeeValidationMessage,
  formToSheetRow,
  initialEmployeeForm,
  isCeoPosition,
  maskAadhar,
  maskPan,
  maxBirthDateForMinAge,
  sanitizePersonNameInput,
  sheetRowToForm,
  todayIsoDate,
  validateEmployeeForm,
  type EmployeeFieldErrors,
  type EmployeeFormState,
} from "@/lib/employee";
import { POSITIONS, ROLES } from "@/app/consts/common";
import { useAuth } from "@/contexts/auth-provider";
import { canManageEmployees } from "@/lib/auth/roles";
import { joinSkillsValue, parseSkillsValue } from "@/app/consts/tech-skills";
import { fetchProjects, getProjectsForEmployee, type ProjectInfo } from "../../lib/projects-client";
import { Select } from "../ui/select";
import { resolveProfileImageSrc } from "@/lib/employee/documents";
import { type DocumentField, FileUploaderField } from "../ui/file-uploader";
import { IndianPhoneInput } from "../ui/indian-phone-input";
import { SkillsChipsInput } from "../ui/skills-chips-input";
import { DateInput } from "../ui/date-input";
import { FormSkeleton } from "../ui/form-skeleton";

function FormField({
  label,
  id,
  children,
  className,
  error,
  optional,
}: {
  label: string;
  id: string;
  children: React.ReactNode;
  className?: string;
  error?: string;
  optional?: boolean;
}) {
  return (
    <div className={className ?? "space-y-2"}>
      <Label htmlFor={id}>
        {label}
        {optional ? <span className="text-ex-muted font-normal"> (optional)</span> : null}
      </Label>
      {children}
      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
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
  const [skillSuggestions, setSkillSuggestions] = useState<string[]>([]);
  const [allProjects, setAllProjects] = useState<ProjectInfo[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [skillsLoading, setSkillsLoading] = useState(true);
  const [skillsError, setSkillsError] = useState<string | null>(null);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(isEdit);
  const [headersLoading, setHeadersLoading] = useState(!isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [documentFiles, setDocumentFiles] = useState<Partial<Record<DocumentField, File>>>({});
  const [profileImagePreview, setProfileImagePreview] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<EmployeeFieldErrors>({});

  const profileImageSrc = resolveProfileImageSrc(form.profileImage, profileImagePreview);
  const maxBirthDate = useMemo(() => maxBirthDateForMinAge(), []);
  const todayDate = useMemo(() => todayIsoDate(), []);
  const hideCeoEmploymentFields = isCeoPosition(form.position);

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

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        setSkillsError(null);
        setSkillsLoading(true);

        const response = await fetch("/api/employee/skills");
        const result = await response.json();

        if (cancelled) return;

        if (result.success) {
          setSkillSuggestions(Array.isArray(result.skills) ? result.skills : []);
        } else {
          setSkillsError(result.message || "Failed to load skill suggestions");
          setSkillSuggestions([]);
        }
      } catch {
        if (!cancelled) {
          setSkillsError("Failed to load skill suggestions");
          setSkillSuggestions([]);
        }
      } finally {
        if (!cancelled) {
          setSkillsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        setProjectsError(null);
        setProjectsLoading(true);

        const projects = await fetchProjects();
        if (cancelled) return;

        setAllProjects(projects);
      } catch {
        if (!cancelled) {
          setProjectsError("Failed to load project list");
          setAllProjects([]);
        }
      } finally {
        if (!cancelled) {
          setProjectsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const employeeProjects = useMemo(
    () => getProjectsForEmployee(form.name, allProjects),
    [form.name, allProjects],
  );

  const update =
    (field: keyof EmployeeFormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      let value = e.target.value;
      if (field === "panNumber") {
        value = value
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, "")
          .slice(0, 10);
      } else if (field === "aadharNumber") {
        value = value.replace(/\D/g, "").slice(0, 12);
      } else if (field === "bankAccountNumber") {
        value = value.replace(/\D/g, "").slice(0, BANK_ACCOUNT_MAX_LENGTH);
      } else if (field === "name" || field === "parentName") {
        value = sanitizePersonNameInput(value);
      }

      setForm((prev) => {
        const next = { ...prev, [field]: value };
        if (field === "position" && isCeoPosition(value)) {
          next.experience = "";
          next.joiningDate = "";
          next.lastIncrementDate = "";
          next.salary = "";
        }
        return next;
      });

      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        if (field === "position" && isCeoPosition(value)) {
          delete next.experience;
          delete next.joiningDate;
          delete next.lastIncrementDate;
          delete next.salary;
        }
        return next;
      });
    };

  const updateField = (field: keyof EmployeeFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
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
          { username?: string; initialPassword?: string } | undefined;
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

      if (result.errors && typeof result.errors === "object") {
        setFieldErrors(result.errors as EmployeeFieldErrors);
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

    const errors = validateEmployeeForm(form);
    setFieldErrors(errors);

    const message = firstEmployeeValidationMessage(errors);
    if (message) {
      setError(message);
      return;
    }

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
              <CardTitle>Employee Details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <FormField label="Name" id="name" error={fieldErrors.name}>
                <Input
                  id="name"
                  value={form.name}
                  onChange={update("name")}
                  placeholder="First Last"
                  required
                  aria-invalid={Boolean(fieldErrors.name)}
                />
                <p className="text-ex-muted text-xs">
                  Full name with first and last name. Letters only — no numbers or random text.
                </p>
              </FormField>

              <FormField label="Role" id="role" error={fieldErrors.role}>
                <Select
                  id="role"
                  value={form.role}
                  onChange={update("role")}
                  disabled={isEdit && !canEditRole}
                  required
                  aria-invalid={Boolean(fieldErrors.role)}
                >
                  <option value="">Select Role</option>
                  <option value={ROLES.SUPER_ADMIN}>Super Administrator</option>
                  <option value={ROLES.HR_MANAGER}>HR Manager</option>
                  <option value={ROLES.EMPLOYEE}>Employee</option>
                </Select>
              </FormField>

              <div className="space-y-2 sm:col-span-2">
                <FormField label="Address" id="address" error={fieldErrors.address}>
                  <Textarea
                    id="address"
                    value={form.address}
                    onChange={update("address")}
                    placeholder="House/flat, street, area, city, pincode"
                    rows={3}
                    required
                    aria-invalid={Boolean(fieldErrors.address)}
                  />
                  <p className="text-ex-muted text-xs">
                    Enter a complete residential address. Short placeholders like &quot;test&quot;
                    are not allowed.
                  </p>
                </FormField>
              </div>

              <FormField label="Birthday date" id="birthdayDate" error={fieldErrors.birthdayDate}>
                <DateInput
                  id="birthdayDate"
                  value={form.birthdayDate}
                  onChange={(birthdayDate) => updateField("birthdayDate", birthdayDate)}
                  maxDate={maxBirthDate}
                  required
                  aria-invalid={Boolean(fieldErrors.birthdayDate)}
                />
                <p className="text-ex-muted text-xs">Employee must be at least 18 years old.</p>
              </FormField>

              <FormField label="PAN number" id="panNumber" error={fieldErrors.panNumber} optional>
                <Input
                  id="panNumber"
                  value={form.panNumber}
                  onChange={update("panNumber")}
                  placeholder="AAAAA9999A"
                  autoComplete="off"
                  maxLength={10}
                  aria-invalid={Boolean(fieldErrors.panNumber)}
                />
                {form.panNumber ? (
                  <p className="text-ex-muted text-xs">Displayed as {maskPan(form.panNumber)}</p>
                ) : null}
              </FormField>

              <FormField
                label="Aadhaar number"
                id="aadharNumber"
                error={fieldErrors.aadharNumber}
                optional
              >
                <Input
                  id="aadharNumber"
                  value={form.aadharNumber}
                  onChange={update("aadharNumber")}
                  placeholder="12-digit Aadhaar Number"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={12}
                  aria-invalid={Boolean(fieldErrors.aadharNumber)}
                />
                {form.aadharNumber ? (
                  <p className="text-ex-muted text-xs">
                    Displayed as {maskAadhar(form.aadharNumber)}
                  </p>
                ) : null}
              </FormField>

              <FormField
                label="Bank account number"
                id="bankAccountNumber"
                error={fieldErrors.bankAccountNumber}
                optional
              >
                <Input
                  id="bankAccountNumber"
                  value={form.bankAccountNumber}
                  onChange={update("bankAccountNumber")}
                  placeholder={`${BANK_ACCOUNT_MIN_LENGTH}–${BANK_ACCOUNT_MAX_LENGTH} digit account number`}
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={BANK_ACCOUNT_MAX_LENGTH}
                  aria-invalid={Boolean(fieldErrors.bankAccountNumber)}
                />
                <p className="text-ex-muted text-xs">
                  Leave blank if unknown. If entered, must be {BANK_ACCOUNT_MIN_LENGTH}–
                  {BANK_ACCOUNT_MAX_LENGTH} digits.
                </p>
              </FormField>
            </CardContent>
          </Card>

          {!isEdit ? (
            <Card>
              <CardHeader>
                <CardTitle>Documents</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
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
              <CardTitle>Parent / Guardian Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4 grid gap-4 sm:grid-cols-2">
                <FormField
                  label="Parent / Guardian Name"
                  id="parentName"
                  error={fieldErrors.parentName}
                >
                  <Input
                    id="parentName"
                    value={form.parentName}
                    onChange={update("parentName")}
                    placeholder="Parent / Guardian Name"
                    required
                    aria-invalid={Boolean(fieldErrors.parentName)}
                  />
                </FormField>
                <FormField
                  label="Parent / Guardian Contact"
                  id="parentContact"
                  error={fieldErrors.parentContact}
                >
                  <IndianPhoneInput
                    id="parentContact"
                    value={form.parentContact}
                    onChange={(value) => updateField("parentContact", value)}
                    placeholder="Parent / Guardian Contact"
                    required
                    aria-invalid={Boolean(fieldErrors.parentContact)}
                  />
                </FormField>
              </div>
              <FormField
                label="Parent / Guardian Details"
                id="parentDetails"
                error={fieldErrors.parentDetails}
              >
                <Textarea
                  id="parentDetails"
                  value={form.parentDetails}
                  onChange={update("parentDetails")}
                  placeholder="Relationship, address, or other guardian details"
                  required
                  aria-invalid={Boolean(fieldErrors.parentDetails)}
                />
              </FormField>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Projects</CardTitle>
            </CardHeader>
            <CardContent className="py-2">
              {projectsLoading ? (
                <p>Loading project assignments…</p>
              ) : !form.name.trim() ? (
                <p>Enter employee name to see assigned projects.</p>
              ) : employeeProjects.length > 0 ? (
                <>
                  {employeeProjects.map((project, index) => (
                    <p
                      key={`${project.name}-${index}`}
                      className={`${project.status === "inactive" ? "opacity-50" : ""}`}
                    >
                      {project.name}
                      <span className={`${project.status === "inactive" ? "text-sm" : ""}`}>
                        {project.status === "inactive" && " [Inactive]"}
                      </span>
                    </p>
                  ))}
                </>
              ) : (
                <p>No projects found for this employee.</p>
              )}
            </CardContent>
          </Card>
          {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
          {projectsError ? (
            <p className="text-sm text-red-600 dark:text-red-400">{projectsError}</p>
          ) : null}
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
                  <FormField label="Postion" id="position" error={fieldErrors.position}>
                    <Select
                      id="position"
                      value={form.position}
                      onChange={update("position")}
                      required
                      aria-invalid={Boolean(fieldErrors.position)}
                    >
                      <option value="">Select</option>
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
                  <FormField label="Email" id="email" error={fieldErrors.email}>
                    <Input
                      id="email"
                      type="email"
                      value={form.email}
                      onChange={update("email")}
                      placeholder="Email Address"
                      required
                      aria-invalid={Boolean(fieldErrors.email)}
                    />
                    <p className="text-ex-muted text-xs">
                      Use a real email with a valid domain (e.g. gmail.com, yahoo.com, company.com).
                    </p>
                  </FormField>
                </div>

                <div className="space-y-2">
                  <FormField label="Username" id="username">
                    <Input
                      id="username"
                      value={form.username}
                      onChange={update("username")}
                      placeholder="Optional — defaults to email before @"
                      autoComplete="off"
                    />
                    <p className="text-ex-muted text-xs">
                      Leave blank to use the part of the email before @ (e.g. swati from
                      swati@gmail.com).
                    </p>
                  </FormField>
                </div>

                <div className="space-y-2">
                  <FormField label="Password" id="password" error={fieldErrors.password}>
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
                      aria-invalid={Boolean(fieldErrors.password)}
                    />
                    <p className="text-ex-muted text-xs">
                      {isEdit
                        ? "If set, must be 8+ characters with uppercase, number, and special character (@, !, etc.). Leave blank to keep current password."
                        : "Leave blank to auto-generate. If entered: 8+ characters with one uppercase letter, one number, and one special character (@, !, etc.). Stored encrypted."}
                    </p>
                  </FormField>
                </div>

                <div className="space-y-2">
                  <FormField
                    label="Contact number"
                    id="contactNumber"
                    error={fieldErrors.contactNumber}
                  >
                    <IndianPhoneInput
                      id="contactNumber"
                      value={form.contactNumber}
                      onChange={(value) => updateField("contactNumber", value)}
                      placeholder="Enter Number"
                      required
                      aria-invalid={Boolean(fieldErrors.contactNumber)}
                    />
                  </FormField>
                </div>

                {!hideCeoEmploymentFields ? (
                  <>
                    <div className="space-y-2">
                      <FormField label="Experience" id="experience" error={fieldErrors.experience}>
                        <Input
                          id="experience"
                          type="number"
                          min={0}
                          max={EMPLOYEE_MAX_EXPERIENCE_YEARS}
                          step={0.1}
                          value={form.experience}
                          onChange={update("experience")}
                          placeholder="Years of experience"
                          aria-invalid={Boolean(fieldErrors.experience)}
                        />
                        <p className="text-ex-muted text-xs">
                          Maximum {EMPLOYEE_MAX_EXPERIENCE_YEARS} years.
                        </p>
                      </FormField>
                    </div>

                    <div className="space-y-2">
                      <FormField
                        label="Joining date"
                        id="joiningDate"
                        error={fieldErrors.joiningDate}
                      >
                        <DateInput
                          id="joiningDate"
                          value={form.joiningDate}
                          onChange={(joiningDate) => updateField("joiningDate", joiningDate)}
                          maxDate={todayDate}
                          required
                          aria-invalid={Boolean(fieldErrors.joiningDate)}
                        />
                      </FormField>
                    </div>

                    <div className="space-y-2">
                      <FormField
                        label="Last increment date"
                        id="lastIncrementDate"
                        error={fieldErrors.lastIncrementDate}
                      >
                        <DateInput
                          id="lastIncrementDate"
                          value={form.lastIncrementDate}
                          onChange={(lastIncrementDate) =>
                            updateField("lastIncrementDate", lastIncrementDate)
                          }
                          maxDate={todayDate}
                          disabled={!canEditLastIncrement}
                          aria-invalid={Boolean(fieldErrors.lastIncrementDate)}
                        />
                      </FormField>
                    </div>

                    {canManage ? (
                      <div className="space-y-2 sm:col-span-2">
                        <FormField label="Salary (monthly)" id="salary" error={fieldErrors.salary}>
                          <Input
                            id="salary"
                            type="text"
                            inputMode="decimal"
                            value={form.salary}
                            onChange={update("salary")}
                            placeholder="e.g. 50000 or 5,00,000"
                            autoComplete="off"
                            aria-invalid={Boolean(fieldErrors.salary)}
                          />
                          <p className="text-ex-muted text-xs">
                            Positive amount only. Visible to HR and super admin — stored in the
                            employee sheet.
                          </p>
                        </FormField>
                      </div>
                    ) : null}
                  </>
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
                <SkillsChipsInput
                  id="skills"
                  value={parseSkillsValue(form.skills)}
                  suggestions={skillSuggestions}
                  onChange={(skills) =>
                    setForm((prev) => ({ ...prev, skills: joinSkillsValue(skills) }))
                  }
                  disabled={skillsLoading}
                />
                <p className="text-ex-muted text-xs">
                  {skillsError
                    ? skillsError
                    : skillsLoading
                      ? "Loading skill suggestions…"
                      : "Type a skill and click Add. Click chips to select."}
                </p>
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
