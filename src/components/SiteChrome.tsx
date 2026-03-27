"use client";

import { usePathname } from "next/navigation";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteDesktopHeader, SiteHeader, SiteMobileHeader } from "@/components/SiteHeader";
import { SiteMobileNav } from "@/components/SiteMobileNav";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { MOBILE_QUERY } from "@/hooks/useMobileUi";

type SiteChromeProps = {
  children: React.ReactNode;
};

function isMarketingPath(pathname: string | null) {
  return pathname === "/";
}

function isFullscreenPath(pathname: string | null) {
  return pathname === "/waitlist";
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
  const isMobile = useMediaQuery(MOBILE_QUERY);

  if (isMobile === null) {
    return (
      <div className="site-layout app-layout app-layout-pending">
        <main className="site-main site-main--app">{children}</main>
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="site-layout app-layout app-layout-mobile">
        <SiteMobileHeader />
        <main className="site-main site-main--app site-main--app-mobile">{children}</main>
        <SiteMobileNav />
      </div>
    );
  }

  return (
    <div className="site-layout app-layout app-layout-desktop">
      <SiteDesktopHeader />
      <main className="site-main site-main--app site-main--app-desktop">{children}</main>
    </div>
  );
}

export function SiteChrome({ children }: SiteChromeProps) {
  const pathname = usePathname();
  const marketing = isMarketingPath(pathname);
  const fullscreen = isFullscreenPath(pathname);

  if (fullscreen) return <>{children}</>;
  return marketing ? <MarketingLayout>{children}</MarketingLayout> : <AppLayout>{children}</AppLayout>;
}
