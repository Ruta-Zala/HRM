"use client";

import { useRouter } from "next/navigation";

import { BrandLogo } from "@/components/brand/brand-logo";
import { AccessDenied } from "@/components/ui/access-denied";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/auth-provider";

export default function AccountInactivePage() {
  const router = useRouter();
  const { logout, loading } = useAuth();

  return (
    <div className="bg-ex-bg relative flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div
        aria-hidden
        className="from-ex-secondary/8 pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] via-transparent to-transparent"
      />
      <Card className="border-ex-border relative z-10 w-full max-w-lg shadow-lg dark:shadow-none">
        <CardContent className="pt-8">
          <BrandLogo size="md" className="mx-auto mb-6" />
          <AccessDenied
            title="Account deactivated"
            description="You cannot access this route. Your account is inactive. Contact HR or your administrator if you believe this is a mistake."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={loading}
                  onClick={() => router.push("/login")}
                >
                  Back to sign in
                </Button>
                <Button type="button" disabled={loading} onClick={() => void logout()}>
                  Sign out
                </Button>
              </div>
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
