"use client";

import { useState } from "react";

import { useCompanyBranding } from "@/lib/branding/use-company-branding";
import { cn } from "@/lib/utils";

const sizeConfig = {
  sm: { box: "size-10 rounded-lg", padding: "p-1", text: "text-sm" },
  md: { box: "size-14 rounded-2xl", padding: "p-2", text: "text-lg" },
  lg: { box: "size-16 rounded-2xl", padding: "p-2", text: "text-xl" },
} as const;

type BrandLogoProps = {
  size?: keyof typeof sizeConfig;
  priority?: boolean;
  className?: string;
};

export function BrandLogo({ size = "md", className }: BrandLogoProps) {
  const config = sizeConfig[size];
  const { branding } = useCompanyBranding();
  const name = branding.companyName.trim() || "HRM";
  const initial = name.charAt(0).toUpperCase() || "H";
  const logoSrc = branding.hasLogo
    ? branding.logoUrl ||
      `/api/branding/public/logo?v=${encodeURIComponent(branding.updatedAt || "1")}`
    : null;

  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = Boolean(logoSrc) && failedSrc !== logoSrc;

  return (
    <div
      className={cn(
        "ring-ex-border relative shrink-0 overflow-hidden bg-white ring-1",
        config.box,
        className,
      )}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={logoSrc}
          src={logoSrc!}
          alt={name}
          className={cn("absolute inset-0 h-full w-full object-contain", config.padding)}
          onError={() => setFailedSrc(logoSrc)}
        />
      ) : (
        <span
          className={cn(
            "text-ex-primary absolute inset-0 flex items-center justify-center font-semibold",
            config.text,
          )}
          aria-label={name}
        >
          {initial}
        </span>
      )}
    </div>
  );
}
