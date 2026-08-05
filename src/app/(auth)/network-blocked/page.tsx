"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * TEMP DISABLED: office Wi‑Fi / WFH network restriction blocked page.
 * Original page is commented below. Uncomment it (and remove this redirect) to re-enable.
 * Does not call /api/auth/network-access while disabled.
 */
export default function NetworkBlockedRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);

  return null;
}

// --- Original page (TEMP DISABLED) — uncomment to restore ---
// import { useEffect, useState } from "react";
// import { BrandLogo } from "@/components/brand/brand-logo";
// import { useRouter } from "next/navigation";
//
// import { AccessDenied } from "@/components/ui/access-denied";
// import { Button } from "@/components/ui/button";
// import { Card, CardContent } from "@/components/ui/card";
// import { useAuth } from "@/contexts/auth-provider";
// import { fetchPublicIpv4FromBrowser } from "@/lib/network-access/ip";
//
// export default function NetworkBlockedPage() {
//   const router = useRouter();
//   const { logout, loading, user } = useAuth();
//   const [clientIp, setClientIp] = useState<string>("");
//   const [reason, setReason] = useState<string>("");
//
//   useEffect(() => {
//     let cancelled = false;
//     void (async () => {
//       try {
//         let publicIp = "";
//         try {
//           publicIp = await fetchPublicIpv4FromBrowser();
//         } catch {
//           // continue without — server may still have a forwarded IP on Vercel
//         }
//         const url = publicIp
//           ? `/api/auth/network-access?publicIp=${encodeURIComponent(publicIp)}`
//           : "/api/auth/network-access";
//         const res = await fetch(url, { credentials: "include" });
//         const data = (await res.json()) as {
//           allowed?: boolean;
//           clientIp?: string;
//           reason?: string;
//         };
//         if (cancelled) return;
//         if (data.allowed) {
//           router.replace("/dashboard");
//           return;
//         }
//         setClientIp(data.clientIp?.trim() || publicIp || "");
//         if (data.reason) setReason(data.reason);
//       } catch {
//         // keep empty IP
//       }
//     })();
//     return () => {
//       cancelled = true;
//     };
//   }, [router]);
//
//   return (
//     <div className="bg-ex-bg relative flex min-h-screen flex-col items-center justify-center px-4 py-12">
//       <div
//         aria-hidden
//         className="from-ex-secondary/8 pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] via-transparent to-transparent"
//       />
//       <Card className="border-ex-border relative z-10 w-full max-w-lg shadow-lg dark:shadow-none">
//         <CardContent className="pt-8">
//           <BrandLogo size="md" className="mx-auto mb-6" />
//           <AccessDenied
//             title="Office network required"
//             description={
//               user
//                 ? `This HRM portal is only available on the office Wi‑Fi${
//                     clientIp ? ` (your current IP: ${clientIp})` : ""
//                   }. Connect to an office network, or ask HR to enable remote access for your account if you work from home.${
//                     reason ? ` [${reason}]` : ""
//                   }`
//                 : "This HRM portal is only available on the office Wi‑Fi."
//             }
//             action={
//               <div className="flex flex-wrap justify-center gap-2">
//                 <Button
//                   type="button"
//                   variant="outline"
//                   disabled={loading}
//                   onClick={() => router.refresh()}
//                 >
//                   Try again
//                 </Button>
//                 <Button type="button" disabled={loading} onClick={() => void logout()}>
//                   Sign out
//                 </Button>
//               </div>
//             }
//           />
//         </CardContent>
//       </Card>
//     </div>
//   );
// }
