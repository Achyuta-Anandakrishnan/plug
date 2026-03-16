"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { AppContainer } from "@/components/product/ProductUI";
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

function AccountButton({ signedIn }: { signedIn: boolean }) {
  if (!signedIn) {
    return (
      <Link href="/signin" className="site-account-trigger">
        Account
      </Link>
    );
  }

  return (
    <details className="site-account-menu">
      <summary className="site-account-trigger">Account</summary>
      <div className="site-account-popover">
        <Link href="/settings">Settings</Link>
        <button type="button" onClick={() => signOut()}>
          Sign out
        </button>
      </div>
    </details>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);

  const canUseDom = typeof document !== "undefined";
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
        || pathname?.startsWith("/listings/")
        || pathname?.startsWith("/explore/")
        || pathname?.startsWith("/auctions/");
    }
    return pathname === item.href || pathname?.startsWith(`${item.href}/`);
  };

  useEffect(() => {
    if (!canUseDom) return;
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [canUseDom, mobileOpen]);

  const mobileDrawer =
    canUseDom && mobileOpen
      ? createPortal(
          <div className="site-mobile-overlay md:hidden">
            <button
              type="button"
              className="site-mobile-backdrop"
              aria-label="Close menu"
              onClick={() => setMobileOpen(false)}
            />
            <aside className="site-mobile-drawer">
              <div className="site-mobile-head">
                <Brand />
                <button type="button" onClick={() => setMobileOpen(false)} className="site-mobile-close">
                  Close
                </button>
              </div>
              <nav className="site-mobile-nav">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`site-mobile-link ${isNavActive(item) ? "is-active" : ""}`}
                  >
                    {item.label}
                  </Link>
                ))}
                {isAdmin ? (
                  <Link
                    href="/admin/sellers"
                    onClick={() => setMobileOpen(false)}
                    className="site-mobile-link"
                  >
                    Admin
                  </Link>
                ) : null}
              </nav>
              <div className="site-mobile-actions">
                <Link
                  href={isVerifiedSeller ? "/sell" : "/seller/verification"}
                  onClick={() => setMobileOpen(false)}
                  className="app-button app-button-primary"
                >
                  Create listing
                </Link>
                <Link
                  href={session?.user?.id ? "/settings" : "/signin"}
                  onClick={() => setMobileOpen(false)}
                  className="app-button app-button-secondary"
                >
                  Account
                </Link>
              </div>
            </aside>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <header className="site-header">
        <AppContainer>
          <div className="site-header-row">
            <div className="site-header-left">
              <button
                type="button"
                onClick={() => setMobileOpen((open) => !open)}
                className="site-menu-trigger md:hidden"
                aria-expanded={mobileOpen}
                aria-label={mobileOpen ? "Close menu" : "Open menu"}
              >
                Menu
              </button>
              <Brand />
            </div>

            <nav className="site-nav hidden md:flex">
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

            <div className="site-header-actions hidden md:flex">
              <Link
                href={isVerifiedSeller ? "/sell" : "/seller/verification"}
                className="app-button app-button-primary"
              >
                Create listing
              </Link>
              <AccountButton signedIn={Boolean(session?.user?.id)} />
            </div>
          </div>
        </AppContainer>
      </header>
      {mobileDrawer}
    </>
  );
}
