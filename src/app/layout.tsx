import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { AppProviders } from "@/components/AppProviders";
import { NativeShell } from "@/components/native/NativeShell";
import { SiteChrome } from "@/components/SiteChrome";
import "./globals.css";
import "./product-redesign.css";

export const metadata: Metadata = {
  title: "dalow | Live, Auctions, Trades",
  description:
    "For collectors, by collectors. Live shows, auctions, and trades in one modern marketplace.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "dalow",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0b0d12",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AppProviders>
          <NativeShell />
          <div className="app-shell">
            <div className="app-shell-content">
              <SiteChrome>{children}</SiteChrome>
            </div>
          </div>
          <Analytics />
        </AppProviders>
      </body>
    </html>
  );
}
