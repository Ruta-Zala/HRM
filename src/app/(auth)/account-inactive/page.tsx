"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";

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
          <div className="ring-ex-border dark:bg-ex-surface relative mx-auto mb-6 size-14 overflow-hidden rounded-2xl bg-white ring-1">
            <Image
              src="https://exhibytesolution.com/wp-content/uploads/2023/06/cropped-Exhibyte_Logo_Black_Logo-removebg-preview-1.png"
              alt="Exhibyte Solutions"
              fill
              className="object-contain p-2 dark:invert"
              sizes="56px"
            />
          </div>
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
