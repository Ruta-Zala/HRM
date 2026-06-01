"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import {
  installInactiveAccountFetchGuard,
  resetAccountInactiveRedirect,
} from "@/lib/account-inactive-client";

/** Globally redirect to /account-inactive when any API returns ACCOUNT_INACTIVE. */
export function InactiveAccountFetchGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    const uninstall = installInactiveAccountFetchGuard();
    return uninstall;
  }, []);

  useEffect(() => {
    if (pathname?.startsWith("/account-inactive")) {
      resetAccountInactiveRedirect();
    }
  }, [pathname]);

  return children;
}
