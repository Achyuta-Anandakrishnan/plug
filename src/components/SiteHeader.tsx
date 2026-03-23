"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { AppContainer } from "@/components/product/ProductUI";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { MOBILE_QUERY } from "@/hooks/useMobileUi";
import { isPrimaryAdminEmail } from "@/lib/admin-email";

function Brand() {
  return (
    <Link href="/" className="site-brand" aria-label="dalow home">
      <Image
        src="/dalow-logo.svg"
        alt="dalow logo"
        width={64}
        height={64}
        className="site-brand-mark"
        priority
      />
    </Link>
  );
}

type AccountButtonProps = {
  signedIn: boolean;
  isAdmin?: boolean;
  mobile?: boolean;
};

function AccountButton({ signedIn, isAdmin = false, mobile = false }: AccountButtonProps) {
  const triggerClassName = mobile ? "site-account-trigger site-account-trigger-mobile" : "site-account-trigger";

  if (!signedIn) {
    return (
      <Link href="/signin" className={triggerClassName}>
        {mobile ? "Profile" : "Account"}
      </Link>
    );
  }

  return (
    <details className={`site-account-menu ${mobile ? "site-account-menu-mobile" : ""}`}>
      <summary className={triggerClassName}>{mobile ? "Profile" : "Account"}</summary>
      <div className={`site-account-popover ${mobile ? "site-account-popover-mobile" : ""}`}>
        <Link href="/settings">Settings</Link>
        <Link href="/referral">Referral</Link>
        {isAdmin ? <Link href="/admin/sellers">Admin</Link> : null}
        <button type="button" onClick={() => signOut()}>
          Sign out
        </button>
      </div>
    </details>
  );
}

function useSiteHeaderState() {
  const pathname = usePathname();
  const { data: session } = useSession();

  const isVerifiedSeller = session?.user?.role === "SELLER" || session?.user?.role === "ADMIN";
  const isAdmin = session?.user?.role === "ADMIN" || isPrimaryAdminEmail(session?.user?.email);

  const navItems = useMemo(
    () => [
      { key: "market", label: "Market", href: "/listings" },
      { key: "live", label: "Live", href: "/live" },
      { key: "trades", label: "Trades", href: "/trades" },
      { key: "forum", label: "Forum", href: "/forum" },
      { key: "messages", label: "Messages", href: "/messages" },
    ],
    [],
  );

  const isNavActive = (item: (typeof navItems)[number]) => {
    if (item.key === "market") {
      return pathname === "/listings"
        || pathname === "/explore"
        || pathname === "/wants"
        || pathname?.startsWith("/wants/")
        || pathname?.startsWith("/listings/")
        || pathname?.startsWith("/explore/")
        || pathname?.startsWith("/auctions/");
    }
    if (item.key === "live") {
      return pathname === item.href
        || pathname?.startsWith(`${item.href}/`)
        || pathname?.startsWith("/streams/");
    }
    return pathname === item.href || pathname?.startsWith(`${item.href}/`);
  };

  const mobileTitle = useMemo(() => {
    if (!pathname || pathname === "/") return null;
    if (pathname === "/wants") return "Want Board";
    if (pathname.startsWith("/wants/")) return pathname === "/wants/new" ? "Post want" : "Want Board";
    if (
      pathname === "/listings"
      || pathname === "/explore"
      || pathname.startsWith("/listings/")
      || pathname.startsWith("/explore/")
      || pathname.startsWith("/auctions/")
    ) {
      return "Market";
    }
    if (pathname === "/live" || pathname.startsWith("/live/") || pathname.startsWith("/streams/")) {
      return "Live";
    }
    if (pathname === "/trades" || pathname.startsWith("/trades/")) return "Trades";
    if (pathname === "/forum" || pathname.startsWith("/forum/")) return "Forum";
    if (pathname === "/messages" || pathname.startsWith("/messages/")) return "Inbox";
    if (pathname === "/sell") return "Create listing";
    if (pathname === "/settings") return "Settings";
    if (pathname === "/referral") return "Referral";
    if (pathname === "/signin") return "Sign in";
    if (pathname === "/signup") return "Create account";
    return null;
  }, [pathname]);

  return {
    isAdmin,
    isVerifiedSeller,
    mobileTitle,
    navItems,
    isNavActive,
    signedIn: Boolean(session?.user?.id),
  };
}

export function SiteDesktopHeader() {
  const { isAdmin, isVerifiedSeller, navItems, isNavActive, signedIn } = useSiteHeaderState();

  return (
    <header className="site-header site-header-desktop">
      <AppContainer>
        <div className="site-header-row site-header-row-desktop">
          <div className="site-header-left">
            <Brand />
          </div>

          <nav className="site-nav" aria-label="Primary">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`site-nav-link ${isNavActive(item) ? "is-active" : ""}`}
              >
                {item.label}
              </Link>
            ))}
            {isAdmin ? (
              <Link href="/admin/sellers" className="site-admin-link">
                Admin
              </Link>
            ) : null}
          </nav>

          <div className="site-header-actions">
            <Link
              href={isVerifiedSeller ? "/sell" : "/seller/verification"}
              className="app-button app-button-primary"
            >
              Create listing
            </Link>
            <AccountButton signedIn={signedIn} isAdmin={isAdmin} />
          </div>
        </div>
      </AppContainer>
    </header>
  );
}

export function SiteMobileHeader() {
  const { isAdmin, mobileTitle, signedIn } = useSiteHeaderState();

  return (
    <header className="site-header site-header-mobile">
      <div className="site-shell">
        <div className="site-header-row site-header-row-mobile">
          <div className="site-header-left">
            <Brand />
          </div>

          {mobileTitle ? (
            <div className="site-mobile-title" aria-hidden="true">
              {mobileTitle}
            </div>
          ) : null}

          <div className="site-mobile-header-actions">
            <AccountButton signedIn={signedIn} isAdmin={isAdmin} mobile />
          </div>
        </div>
      </div>
    </header>
  );
}

export function SiteHeader() {
  const isMobile = useMediaQuery(MOBILE_QUERY);

  if (isMobile) {
    return <SiteMobileHeader />;
  }

  return <SiteDesktopHeader />;
}
