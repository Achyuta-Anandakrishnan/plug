"use client";

import { usePathname } from "next/navigation";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteMobileNav } from "@/components/SiteMobileNav";

type SiteChromeProps = {
  children: React.ReactNode;
};

function isMarketingPath(pathname: string | null) {
  return pathname === "/";
}

export function MarketingLayout({ children }: SiteChromeProps) {
  return (
    <div className="site-layout marketing-layout">
      <SiteHeader />
      <main className="site-main site-main--marketing">{children}</main>
      <SiteFooter />
    </div>
  );
}

export function AppLayout({ children }: SiteChromeProps) {
  return (
    <div className="site-layout app-layout">
      <SiteHeader />
      <main className="site-main site-main--app">{children}</main>
      <SiteMobileNav />
    </div>
  );
}

export function SiteChrome({ children }: SiteChromeProps) {
  const pathname = usePathname();
  const marketing = isMarketingPath(pathname);

  return marketing ? <MarketingLayout>{children}</MarketingLayout> : <AppLayout>{children}</AppLayout>;
}
