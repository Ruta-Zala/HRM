"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { readResponseJson } from "@/lib/api/read-response-json";
import { EMPTY_COMPANY_BRANDING, type CompanyBranding } from "@/lib/branding/types";
import { useAuth } from "@/contexts/auth-provider";

type CompanyBrandingContextValue = {
  branding: CompanyBranding;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  setBranding: (next: CompanyBranding) => void;
};

const CompanyBrandingContext = createContext<CompanyBrandingContextValue | null>(null);

function withAssetCacheBust(branding: CompanyBranding): CompanyBranding {
  const bust = branding.updatedAt ? `?v=${encodeURIComponent(branding.updatedAt)}` : "";
  return {
    ...branding,
    // Public logo URL works in <img> / sidebar without auth flakiness.
    logoUrl: branding.hasLogo ? `/api/branding/public/logo${bust}` : null,
    backgroundUrl: branding.hasBackground ? `/api/branding/assets/background${bust}` : null,
  };
}

function withPublicLogoUrl(partial: {
  companyName?: string;
  hasLogo?: boolean;
  logoUrl?: string | null;
  updatedAt?: string;
}): CompanyBranding {
  const hasLogo = Boolean(partial.hasLogo);
  const updatedAt = String(partial.updatedAt ?? "").trim();
  const bust = updatedAt ? `?v=${encodeURIComponent(updatedAt)}` : "";
  return {
    ...EMPTY_COMPANY_BRANDING,
    companyName: String(partial.companyName ?? "").trim(),
    hasLogo,
    logoUrl: hasLogo ? partial.logoUrl || `/api/branding/public/logo${bust}` : null,
    updatedAt,
  };
}

export function CompanyBrandingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [branding, setBrandingState] = useState<CompanyBranding>(EMPTY_COMPANY_BRANDING);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setBranding = useCallback((next: CompanyBranding) => {
    setBrandingState(withAssetCacheBust(next));
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (user) {
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
          throw new Error(json.message ?? "Failed to load company branding");
        }
        setBrandingState(withAssetCacheBust(json.branding));
      } else {
        const res = await fetch("/api/branding/public", { cache: "no-store" });
        const json = await readResponseJson<{
          success: boolean;
          message?: string;
          branding?: {
            companyName?: string;
            hasLogo?: boolean;
            logoUrl?: string | null;
            updatedAt?: string;
          };
        }>(res, "fetch");
        if (!json.success || !json.branding) {
          throw new Error(json.message ?? "Failed to load company branding");
        }
        setBrandingState(withPublicLogoUrl(json.branding));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load company branding");
      setBrandingState(EMPTY_COMPANY_BRANDING);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial / auth-change branding load
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({ branding, loading, error, refresh, setBranding }),
    [branding, loading, error, refresh, setBranding],
  );

  return (
    <CompanyBrandingContext.Provider value={value}>{children}</CompanyBrandingContext.Provider>
  );
}

export function useCompanyBranding(): CompanyBrandingContextValue {
  const ctx = useContext(CompanyBrandingContext);
  if (!ctx) {
    throw new Error("useCompanyBranding must be used within CompanyBrandingProvider");
  }
  return ctx;
}
