import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { AppProviders } from "@/components/AppProviders";
import { NativeShell } from "@/components/native/NativeShell";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vyre | Verified Live Streams",
  description:
    "A sleek, secure live stream marketplace with verified sellers and buyer protections.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Vyre",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f6f9ff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AppProviders>
          <NativeShell />
          <div className="app-shell flex min-h-screen flex-col">
            <SiteHeader />
            <main className="page-container mobile-safe-main flex-1 pt-5 sm:pt-16 lg:pt-20">
              {children}
            </main>
            <SiteFooter />
          </div>
          <Analytics />
        </AppProviders>
      </body>
    </html>
  );
}
