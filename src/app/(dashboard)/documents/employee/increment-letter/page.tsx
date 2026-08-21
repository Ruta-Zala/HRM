"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/ui/page-header";
import { AccessDenied } from "@/components/ui/access-denied";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-provider";
import { canManageEmployees } from "@/lib/auth/roles";
import { useCompanyBranding } from "@/lib/branding/use-company-branding";

import { useLetterEmployees } from "../../_shared/use-letter-employees";
import { printLetter, todayIso } from "../../_shared/letter-utils";
import styles from "../../_shared/letter.module.css";
import { buildIncrementLetterData } from "./generate";
import IncrementLetterTemplate from "./letter-template";
import type { IncrementFormState } from "./types";

export default function IncrementLetterPage() {
  const { user } = useAuth();
  const canManage = user ? canManageEmployees(user.role) : false;
  const { branding } = useCompanyBranding();
  const { employees, loading, error } = useLetterEmployees(canManage);

  const [form, setForm] = useState<IncrementFormState>({
    employeeSheetRow: "",
    candidateName: "",
    address: "",
    letterDate: todayIso(),
    effectiveDate: todayIso(),
    revisedSalary: "",
    loyaltyBonusRate: "10",
    interestRate: "4",
  });

  function update<K extends keyof IncrementFormState>(key: K, value: IncrementFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function selectEmployee(sheetRow: string) {
    const employee = employees.find((e) => e.sheetRow === sheetRow);
    setForm((prev) => ({
      ...prev,
      employeeSheetRow: sheetRow,
      candidateName: employee?.name ?? "",
      address: employee?.address ?? "",
    }));
  }

  const data = useMemo(
    () =>
      buildIncrementLetterData(form, {
        name: branding.companyName,
        address: branding.companyAddress,
      }),
    [form, branding.companyName, branding.companyAddress],
  );

  const isReady = Boolean(
    form.candidateName.trim() && form.letterDate && form.effectiveDate && form.revisedSalary.trim(),
  );

  if (!canManage) {
    return (
      <div className="space-y-8">
        <PageHeader title="Increment Letter" description="Generate a salary increment letter." />
        <AccessDenied
          description="Document generation is only available to HR and Super Admin."
          action={
            <Link href="/documents/employee">
              <Button variant="outline" size="sm">
                <ArrowLeft className="size-4" />
                Back to documents
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 lg:h-[calc(100dvh-8.5rem)] lg:overflow-hidden">
      <PageHeader
        className="shrink-0"
        title="Increment Letter"
        description="Pick an employee and fill in the increment details."
        actions={
          <Link href="/documents/employee">
            <Button variant="outline" size="sm">
              <ArrowLeft className="size-4" />
              Back to documents
            </Button>
          </Link>
        }
      />

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <div className="divide-ex-border -mx-4 grid min-h-0 flex-1 grid-cols-1 gap-6 px-2 lg:mx-0 lg:grid-cols-2 lg:gap-0 lg:divide-x lg:overflow-hidden lg:px-0">
        <div className="lg:overflow-y-auto lg:pr-6">
          <Card className="print:hidden">
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="candidate">Employee</Label>
                <Select
                  id="candidate"
                  value={form.employeeSheetRow}
                  onChange={(e) => selectEmployee(e.target.value)}
                  disabled={loading}
                >
                  <option value="">{loading ? "Loading Employees…" : "Select Employee"}</option>
                  {employees.map((employee) => (
                    <option key={employee.sheetRow} value={employee.sheetRow}>
                      {employee.name} ({employee.employeeId})
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Textarea
                  id="address"
                  rows={3}
                  value={form.address}
                  onChange={(e) => update("address", e.target.value)}
                  placeholder="Employee Address"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="revisedSalary">Revised salary (₹)</Label>
                <Input
                  id="revisedSalary"
                  value={form.revisedSalary}
                  onChange={(e) => update("revisedSalary", e.target.value)}
                  placeholder="e.g. 17000"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="loyaltyBonusRate">Loyalty bonus (%)</Label>
                <Input
                  id="loyaltyBonusRate"
                  value={form.loyaltyBonusRate}
                  onChange={(e) => update("loyaltyBonusRate", e.target.value)}
                  placeholder="10"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="interestRate">RD interest rate (%)</Label>
                <Input
                  id="interestRate"
                  value={form.interestRate}
                  onChange={(e) => update("interestRate", e.target.value)}
                  placeholder="4"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="letterDate">Letter date</Label>
                <Input
                  id="letterDate"
                  type="date"
                  value={form.letterDate}
                  onChange={(e) => update("letterDate", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="effectiveDate">Effective date</Label>
                <Input
                  id="effectiveDate"
                  type="date"
                  value={form.effectiveDate}
                  onChange={(e) => update("effectiveDate", e.target.value)}
                />
              </div>

              <Button onClick={printLetter} disabled={!isReady} className="mt-1">
                Print / Save PDF
              </Button>
              {!isReady ? (
                <p className="text-ex-muted text-xs">
                  Select an employee and fill in the salary and date to enable printing.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <div className="min-h-0 lg:pl-6">
          <div
            className={`${styles.previewPanel} border-ex-border bg-ex-elevated/40 overflow-x-hidden overflow-y-auto rounded-xl border p-4 lg:h-full print:overflow-visible print:border-0 print:bg-transparent print:p-0`}
          >
            <div className={styles.previewScaler}>
              <IncrementLetterTemplate data={data} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
