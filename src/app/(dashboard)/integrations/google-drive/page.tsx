"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type DriveStatus = {
  oauthConfigured: boolean;
  oauthConnected: boolean;
  oauthRedirectUri: string;
  impersonation: boolean;
};

export default function GoogleDriveIntegrationPage() {
  return (
    <Suspense fallback={<p className="text-ex-muted text-sm">Loading…</p>}>
      <GoogleDriveIntegrationContent />
    </Suspense>
  );
}

function GoogleDriveIntegrationContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<DriveStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const connected = searchParams.get("connected") === "1";
  const error = searchParams.get("error");

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/integrations/google-drive/status");
        const data = await res.json();
        if (data.success) {
          setStatus({
            oauthConfigured: data.oauthConfigured,
            oauthConnected: data.oauthConnected,
            oauthRedirectUri: data.oauthRedirectUri,
            impersonation: data.impersonation,
          });
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [connected]);

  const isConnected = status?.oauthConnected || status?.impersonation || false;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Google Drive"
        description="Personal Gmail cannot use service-account uploads. Connect your account once so images and documents upload to your My Drive HRM folder."
        actions={
          <Link href="/integrations">
            <Button variant="ghost" size="sm" type="button">
              ← Integrations
            </Button>
          </Link>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Connection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {loading ? (
            <p className="text-ex-muted">Checking…</p>
          ) : (
            <>
              <p>
                Status:{" "}
                <span className={isConnected ? "text-green-600" : "text-amber-600"}>
                  {isConnected ? "Ready" : "Not connected"}
                </span>
              </p>

              {connected ? (
                <p className="text-green-600">
                  Connected. Employee document uploads will use your Gmail storage.
                </p>
              ) : null}

              {error ? (
                <div className="space-y-2 text-red-600">
                  <p>Failed: {decodeURIComponent(error)}</p>

                  {error.includes("missing_code") && (
                    <p className="text-ex-muted text-sm">
                      Finish the full flow: click Connect → Continue on Google → Allow. Do not open
                      the callback URL directly.
                    </p>
                  )}
                </div>
              ) : null}

              {!status?.oauthConfigured ? (
                <div className="text-ex-muted space-y-2">
                  <p>
                    In Google Cloud Console, create an OAuth 2.0 Web client and add to{" "}
                    <code>.env.local</code>:
                  </p>
                  {status?.oauthRedirectUri ? (
                    <pre className="bg-ex-surface-2 overflow-x-auto rounded-md p-3 text-xs">
                      {`GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
GOOGLE_OAUTH_REDIRECT_URI=${status.oauthRedirectUri}`}
                    </pre>
                  ) : null}
                  <p className="text-xs">
                    If you omit <code>GOOGLE_OAUTH_REDIRECT_URI</code>, set{" "}
                    <code>NEXT_PUBLIC_APP_URL</code> to your public app origin (same value used
                    above).
                  </p>
                  <p>
                    Enable Drive API. Add your Gmail as a test user if the app is in Testing mode.
                  </p>
                </div>
              ) : !isConnected ? (
                <a href="/api/integrations/google-drive/connect">
                  <Button type="button">Connect Google Drive</Button>
                </a>
              ) : (
                <p className="text-ex-muted">
                  Your HRM folder stays private. Only this app uploads as you.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
