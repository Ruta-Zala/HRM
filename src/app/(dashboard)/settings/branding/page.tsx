"use client";

import { Loader2, UploadIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/auth-provider";
import { useNotifications } from "@/contexts/notifications-provider";
import { useCompanyBranding } from "@/lib/branding/use-company-branding";
import { readResponseJson } from "@/lib/api/read-response-json";
import { toUserFacingActionError, toUserFacingFetchError } from "@/lib/api/user-facing-error";
import { canManageCompanyBranding } from "@/lib/auth/roles";
import {
  BRANDING_UPLOAD_LIMITS,
  type BrandingAssetKind,
  type CompanyBranding,
} from "@/lib/branding/types";

type PendingAsset = {
  file: File | null;
  objectUrl: string | null;
  /** When true, existing saved asset should be deleted on Save Changes. */
  remove: boolean;
};

const EMPTY_PENDING: PendingAsset = { file: null, objectUrl: null, remove: false };

function revokeObjectUrl(url: string | null) {
  if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
}

export default function CompanyBrandingSettingsPage() {
  const { user } = useAuth();
  const { pushToast } = useNotifications();
  const { branding, setBranding } = useCompanyBranding();
  const canManage = user ? canManageCompanyBranding(user.role) : false;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [companyName, setCompanyName] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [signatoryName, setSignatoryName] = useState("");
  const [hrTitle, setHrTitle] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");

  const [logoPending, setLogoPending] = useState<PendingAsset>(EMPTY_PENDING);
  const [backgroundPending, setBackgroundPending] = useState<PendingAsset>(EMPTY_PENDING);

  const syncFormFromBranding = useCallback((next: CompanyBranding) => {
    setCompanyName(next.companyName);
    setCompanyAddress(next.companyAddress);
    setSignatoryName(next.signatoryName);
    setHrTitle(next.hrTitle);
    setSupportEmail(next.supportEmail);
    setWebsiteUrl(next.websiteUrl);
  }, []);

  const resetPending = useCallback(() => {
    setLogoPending((prev) => {
      revokeObjectUrl(prev.objectUrl);
      return EMPTY_PENDING;
    });
    setBackgroundPending((prev) => {
      revokeObjectUrl(prev.objectUrl);
      return EMPTY_PENDING;
    });
  }, []);

  const load = useCallback(async () => {
    if (!canManage) return;
    setLoading(true);
    try {
      const res = await fetch("/api/settings/branding", {
        credentials: "include",
        cache: "no-store",
      });
      const json = await readResponseJson<{
        success: boolean;
        message?: string;
        branding?: CompanyBranding;
      }>(res, "fetch");
      if (!json.success || !json.branding) {
        throw new Error(json.message ?? "Failed to load branding");
      }
      setBranding(json.branding);
      syncFormFromBranding(json.branding);
      resetPending();
    } catch (err) {
      pushToast({
        title: "Could not load branding",
        body: toUserFacingFetchError(err),
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [canManage, pushToast, resetPending, setBranding, syncFormFromBranding]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial branding form load
    void load();
  }, [load]);

  useEffect(() => {
    return () => {
      revokeObjectUrl(logoPending.objectUrl);
      revokeObjectUrl(backgroundPending.objectUrl);
    };
    // Only revoke on unmount; pending updates manage their own revoke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stageAsset(kind: BrandingAssetKind, file: File | null) {
    if (!canManage || !file) return;

    const maxBytes =
      kind === "logo"
        ? BRANDING_UPLOAD_LIMITS.logoMaxBytes
        : BRANDING_UPLOAD_LIMITS.backgroundMaxBytes;
    const mimeType = (file.type || "").toLowerCase();
    if (
      !BRANDING_UPLOAD_LIMITS.allowedMimeTypes.includes(
        mimeType as (typeof BRANDING_UPLOAD_LIMITS.allowedMimeTypes)[number],
      )
    ) {
      pushToast({
        title: "Invalid image",
        body: "Only PNG, JPEG, or WebP images are allowed.",
        variant: "error",
      });
      return;
    }
    if (file.size > maxBytes) {
      pushToast({
        title: "Image too large",
        body: `Max size is ${Math.round(maxBytes / 1024)} KB.`,
        variant: "error",
      });
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const setter = kind === "logo" ? setLogoPending : setBackgroundPending;
    setter((prev) => {
      revokeObjectUrl(prev.objectUrl);
      return { file, objectUrl, remove: false };
    });
  }

  function stageRemove(kind: BrandingAssetKind) {
    if (!canManage) return;
    const setter = kind === "logo" ? setLogoPending : setBackgroundPending;
    setter((prev) => {
      revokeObjectUrl(prev.objectUrl);
      return { file: null, objectUrl: null, remove: true };
    });
  }

  async function persistAsset(
    kind: BrandingAssetKind,
    pending: PendingAsset,
  ): Promise<CompanyBranding | null> {
    if (pending.file) {
      const form = new FormData();
      form.set("file", pending.file);
      const res = await fetch(`/api/branding/assets/${kind}`, {
        method: "POST",
        credentials: "include",
        body: form,
      });
      const json = await readResponseJson<{
        success: boolean;
        message?: string;
        branding?: CompanyBranding;
      }>(res, "action");
      if (!json.success || !json.branding) {
        throw new Error(json.message ?? `Failed to upload ${kind}`);
      }
      return json.branding;
    }

    if (pending.remove) {
      const res = await fetch(`/api/branding/assets/${kind}`, {
        method: "DELETE",
        credentials: "include",
      });
      const json = await readResponseJson<{
        success: boolean;
        message?: string;
        branding?: CompanyBranding;
      }>(res, "action");
      if (!json.success || !json.branding) {
        throw new Error(json.message ?? `Failed to remove ${kind}`);
      }
      return json.branding;
    }

    return null;
  }

  async function saveChanges() {
    if (!canManage || saving) return;
    setSaving(true);
    try {
      const detailsRes = await fetch("/api/settings/branding", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName,
          companyAddress,
          signatoryName,
          hrTitle,
          supportEmail,
          websiteUrl,
        }),
      });
      const detailsJson = await readResponseJson<{
        success: boolean;
        message?: string;
        branding?: CompanyBranding;
      }>(detailsRes, "action");
      if (!detailsJson.success || !detailsJson.branding) {
        throw new Error(detailsJson.message ?? "Failed to save branding details");
      }

      let next = detailsJson.branding;
      const logoResult = await persistAsset("logo", logoPending);
      if (logoResult) next = logoResult;
      const backgroundResult = await persistAsset("background", backgroundPending);
      if (backgroundResult) next = backgroundResult;

      setBranding(next);
      syncFormFromBranding(next);
      resetPending();
      pushToast({
        title: "Changes saved",
        body: "Company branding was updated. Sidebar and documents will use the new details.",
        variant: "success",
      });
    } catch (err) {
      pushToast({
        title: "Save failed",
        body: toUserFacingActionError(err),
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  if (!canManage) {
    return (
      <div className="space-y-6">
        <PageHeader title="Company Branding" description="Super Admin only." />
        <p className="text-ex-muted text-sm">
          You do not have permission to manage company branding.
        </p>
      </div>
    );
  }

  const logoPreview = logoPending.objectUrl
    ? logoPending.objectUrl
    : logoPending.remove
      ? null
      : branding.logoUrl;
  const backgroundPreview = backgroundPending.objectUrl
    ? backgroundPending.objectUrl
    : backgroundPending.remove
      ? null
      : branding.backgroundUrl;

  const logoHasAsset = Boolean(logoPreview);
  const backgroundHasAsset = Boolean(backgroundPreview);

  return (
    <div className="w-full max-w-full min-w-0 space-y-6">
      <PageHeader
        title="Company Branding"
        description="Edit company details and images, then click Save Changes. Nothing is applied to the sidebar or documents until you save."
      />

      <Card className="w-full max-w-full min-w-0">
        <CardHeader>
          <CardTitle>Company Details</CardTitle>
        </CardHeader>
        <CardContent className="min-w-0">
          {loading ? (
            <div className="text-ex-muted flex items-center gap-2 text-sm">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Loading…
            </div>
          ) : (
            <div className="grid w-full max-w-2xl gap-4">
              <div className="min-w-0 space-y-2">
                <Label htmlFor="companyName">Company name</Label>
                <Input
                  id="companyName"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Your company name"
                  disabled={saving}
                  className="min-w-0"
                />
              </div>
              <div className="min-w-0 space-y-2">
                <Label htmlFor="companyAddress">Company address</Label>
                <Input
                  id="companyAddress"
                  value={companyAddress}
                  onChange={(e) => setCompanyAddress(e.target.value)}
                  placeholder="Full office address"
                  disabled={saving}
                  className="min-w-0"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="min-w-0 space-y-2">
                  <Label htmlFor="signatoryName">Signatory name</Label>
                  <Input
                    id="signatoryName"
                    value={signatoryName}
                    onChange={(e) => setSignatoryName(e.target.value)}
                    disabled={saving}
                    className="min-w-0"
                  />
                </div>
                <div className="min-w-0 space-y-2">
                  <Label htmlFor="hrTitle">HR title</Label>
                  <Input
                    id="hrTitle"
                    value={hrTitle}
                    onChange={(e) => setHrTitle(e.target.value)}
                    disabled={saving}
                    className="min-w-0"
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="min-w-0 space-y-2">
                  <Label htmlFor="supportEmail">Support email</Label>
                  <Input
                    id="supportEmail"
                    type="email"
                    value={supportEmail}
                    onChange={(e) => setSupportEmail(e.target.value)}
                    disabled={saving}
                    className="min-w-0"
                  />
                </div>
                <div className="min-w-0 space-y-2">
                  <Label htmlFor="websiteUrl">Website</Label>
                  <Input
                    id="websiteUrl"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    placeholder="https://"
                    disabled={saving}
                    className="min-w-0"
                  />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid w-full max-w-full min-w-0 grid-cols-1 gap-6 xl:grid-cols-2">
        <AssetCard
          title="Company Logo"
          description="Used on salary slips and the sidebar. PNG, JPEG, or WebP up to 512 KB. Applied only after Save Changes."
          kind="logo"
          hasAsset={logoHasAsset}
          previewUrl={logoPreview}
          disabled={saving}
          onUpload={(file) => stageAsset("logo", file)}
          onRemove={() => stageRemove("logo")}
        />
        <AssetCard
          title="Letter Background"
          description="Full-page letterhead for offer / experience letters. PNG, JPEG, or WebP up to 900 KB. Applied only after Save Changes."
          kind="background"
          hasAsset={backgroundHasAsset}
          previewUrl={backgroundPreview}
          disabled={saving}
          onUpload={(file) => stageAsset("background", file)}
          onRemove={() => stageRemove("background")}
        />
      </div>

      <div className="flex justify-end">
        <Button type="button" disabled={loading || saving} onClick={() => void saveChanges()}>
          {saving ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Saving…
            </>
          ) : (
            "Save Changes"
          )}
        </Button>
      </div>
    </div>
  );
}

function AssetCard({
  title,
  description,
  kind,
  hasAsset,
  previewUrl,
  disabled,
  onUpload,
  onRemove,
}: {
  title: string;
  description: string;
  kind: BrandingAssetKind;
  hasAsset: boolean;
  previewUrl: string | null;
  disabled?: boolean;
  onUpload: (file: File | null) => void;
  onRemove: () => void;
}) {
  const inputId = `branding-${kind}`;

  return (
    <Card className="w-full max-w-full min-w-0">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="min-w-0 space-y-4">
        <p className="text-ex-muted text-sm break-words">{description}</p>
        <div
          className={
            kind === "background"
              ? "border-ex-border bg-ex-bg flex h-48 w-36 max-w-full items-center justify-center overflow-hidden rounded-lg border"
              : "border-ex-border bg-ex-bg flex h-28 w-28 items-center justify-center overflow-hidden rounded-lg border"
          }
        >
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt={title}
              className={
                kind === "background"
                  ? "h-full w-full object-cover"
                  : "h-full w-full object-contain p-2"
              }
            />
          ) : (
            <span className="text-ex-muted px-3 text-center text-xs">Not set</span>
          )}
        </div>
        <div className="relative flex flex-wrap items-center gap-2">
          <input
            id={inputId}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            disabled={disabled}
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              e.target.value = "";
              onUpload(file);
            }}
          />
          <Label
            htmlFor={inputId}
            className="border-ex-border bg-ex-bg hover:border-ex-ring inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm aria-disabled:pointer-events-none aria-disabled:opacity-50"
            aria-disabled={disabled}
          >
            <UploadIcon className="size-4" />
            {hasAsset ? "Replace image" : "Upload image"}
          </Label>
          {hasAsset ? (
            <Button type="button" variant="outline" disabled={disabled} onClick={onRemove}>
              Remove
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
