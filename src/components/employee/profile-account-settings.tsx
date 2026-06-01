"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  required,
  minLength,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <PasswordInput
        id={id}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        minLength={minLength}
      />
    </div>
  );
}

export type ProfileAccountSettingsProps = {
  username: string;
  hasPassword: boolean;
  onPasswordUpdated?: () => void;
};

export function ProfileAccountSettings({
  username,
  hasPassword,
  onPasswordUpdated,
}: ProfileAccountSettingsProps) {
  const [mode, setMode] = useState<"view" | "verify" | "change" | "create">(
    hasPassword ? "view" : "create",
  );
  const resolvedMode = !hasPassword ? "create" : mode === "create" ? "view" : mode;
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function resetForm() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError(null);
    setSuccess(null);
  }

  function openView() {
    resetForm();
    setMode("view");
  }

  async function onVerify(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/employee/me/password/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ currentPassword }),
      });

      const result = (await res.json()) as { success?: boolean; message?: string };

      if (!res.ok || !result.success) {
        setError(result.message ?? "Password verification failed.");
        return;
      }

      setSuccess(result.message ?? "Password verified.");
      setCurrentPassword("");
    } catch {
      setError("Failed to verify password. Please try again.");
    } finally {
      setPending(false);
    }
  }

  async function onChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/employee/me/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          currentPassword: hasPassword ? currentPassword : undefined,
          newPassword,
          confirmPassword,
        }),
      });

      const result = (await res.json()) as { success?: boolean; message?: string };

      if (!res.ok || !result.success) {
        setError(result.message ?? "Failed to update password.");
        return;
      }

      setSuccess(result.message ?? "Password saved.");
      resetForm();
      onPasswordUpdated?.();
      setMode("view");
    } catch {
      setError("Failed to update password. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign-in account</CardTitle>
        <CardDescription>
          Use your username and password to sign in. For security, your saved password cannot be
          shown — you can verify or change it below.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="profile-username">Username</Label>
          <Input
            id="profile-username"
            value={username || "—"}
            readOnly
            disabled
            className="disabled:opacity-100"
          />
          {!username ? (
            <p className="text-ex-muted text-xs">
              No username on file. Contact HR to set one before you can sign in.
            </p>
          ) : null}
        </div>

        {resolvedMode === "view" && hasPassword ? (
          <div className="space-y-4">
            <div className="border-ex-border bg-ex-surface/50 flex items-start gap-3 rounded-lg border px-4 py-3">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <div className="space-y-1">
                <p className="text-ex-primary text-sm font-medium">Password is set</p>
                <p className="text-ex-muted text-xs">
                  Your password is stored encrypted. It cannot be displayed here. Use &quot;Check
                  current password&quot; to confirm you remember it, or &quot;Change password&quot;
                  only when you want a new one.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  resetForm();
                  setMode("verify");
                }}
                disabled={!username}
              >
                Check current password
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  resetForm();
                  setMode("change");
                }}
                disabled={!username}
              >
                Change password
              </Button>
            </div>
          </div>
        ) : null}

        {resolvedMode === "verify" ? (
          <form className="space-y-4" onSubmit={(e) => void onVerify(e)}>
            <p className="text-ex-primary text-sm font-medium">Check current password</p>
            <p className="text-ex-muted text-xs">
              Enter your current password to confirm it is correct. This does not change your
              password.
            </p>
            <PasswordField
              id="verify-current-password"
              label="Current password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={setCurrentPassword}
              required
            />
            {error ? (
              <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
                {error}
              </p>
            ) : null}
            {success ? (
              <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-300">
                {success}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={pending || !username}>
                {pending ? "Checking…" : "Verify password"}
              </Button>
              <Button type="button" variant="outline" onClick={openView}>
                Cancel
              </Button>
            </div>
          </form>
        ) : null}

        {resolvedMode === "change" || resolvedMode === "create" ? (
          <form className="space-y-4" onSubmit={(e) => void onChangePassword(e)}>
            <p className="text-ex-primary text-sm font-medium">
              {resolvedMode === "create" ? "Create password" : "Change password"}
            </p>

            {resolvedMode === "change" ? (
              <PasswordField
                id="current-password"
                label="Current password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={setCurrentPassword}
                required
              />
            ) : (
              <p className="text-ex-muted text-xs">
                You do not have a password yet. Set one below to enable sign-in.
              </p>
            )}

            <PasswordField
              id="new-password"
              label={resolvedMode === "change" ? "New password" : "Password"}
              autoComplete="new-password"
              value={newPassword}
              onChange={setNewPassword}
              required
              minLength={6}
            />

            <PasswordField
              id="confirm-password"
              label="Confirm password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              required
              minLength={6}
            />

            {error ? (
              <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
                {error}
              </p>
            ) : null}

            {success ? (
              <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-300">
                {success}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={pending || !username}>
                {pending
                  ? "Saving…"
                  : resolvedMode === "create"
                    ? "Create password"
                    : "Update password"}
              </Button>
              {hasPassword ? (
                <Button type="button" variant="outline" onClick={openView}>
                  Cancel
                </Button>
              ) : null}
            </div>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}
