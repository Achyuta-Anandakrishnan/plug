import type { Metadata } from "next";
import { AppProviders } from "@/components/AppProviders";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vyre | Verified Live Streams",
  description:
    "A sleek, secure live stream marketplace with verified sellers and buyer protections.",
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
          <div className="flex min-h-screen flex-col">
            <SiteHeader />
            <main className="page-container flex-1 pb-12 pt-4 sm:pb-20 sm:pt-8">
              {children}
            </main>
            <SiteFooter />
          </div>
        </AppProviders>
      </body>
    </html>
  );
}
