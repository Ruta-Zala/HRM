"use client";

import { ThemeProvider } from "@/contexts/theme-provider";
import { AuthProvider } from "@/contexts/auth-provider";
import { CompanyBrandingProvider } from "@/contexts/company-branding-provider";
import { InactiveAccountFetchGuard } from "@/contexts/inactive-account-fetch-guard";
import { StoreProvider } from "@/store/store-provider";
import { DocumentBrandHead } from "@/components/brand/document-brand-head";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <StoreProvider>
        <InactiveAccountFetchGuard>
          <AuthProvider>
            <CompanyBrandingProvider>
              <DocumentBrandHead />
              {children}
            </CompanyBrandingProvider>
          </AuthProvider>
        </InactiveAccountFetchGuard>
      </StoreProvider>
    </ThemeProvider>
  );
}
