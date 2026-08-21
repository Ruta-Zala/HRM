import { DM_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "@/contexts/providers";
import { buildBrandingMetadata } from "@/lib/branding/metadata";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export async function generateMetadata() {
  return buildBrandingMetadata();
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${dmSans.variable} h-full`}>
      <body className="min-h-full antialiased" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
