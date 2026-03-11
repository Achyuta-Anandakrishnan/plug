"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { isPrimaryAdminEmail } from "@/lib/admin-email";

function Brand() {
  return (
    <Link href="/" className="flex items-center" aria-label="dalow home">
      <Image
        src="/dalow-logo.svg"
        alt="dalow logo"
        width={64}
        height={64}
        className="brand-logo h-12 w-auto sm:h-14"
        priority
      />
    </Link>
  );
}

function UserMenu({ signedIn }: { signedIn: boolean }) {
  if (!signedIn) {
    return (
      <Link
        href="/signin"
        className="rounded-full border border-slate-200 bg-white/90 px-3.5 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 sm:px-4 sm:py-2 sm:text-sm"
      >
        Sign in
      </Link>
    );
  }

  return (
    <details className="site-user-menu relative">
      <summary className="cursor-pointer list-none rounded-full border border-slate-200 bg-white/90 px-3.5 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 sm:px-4 sm:py-2 sm:text-sm">
        Account
      </summary>
      <div className="absolute right-0 mt-2 grid min-w-[170px] gap-1 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg shadow-black/10">
        <Link href="/settings" className="rounded-xl px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100">
          Settings
        </Link>
        <button
          onClick={() => signOut()}
          className="rounded-xl px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100"
        >
          Sign out
        </button>
      </div>
    </details>
  );
}

export function SiteHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const { data: session } = useSession();

  const canUseDom = typeof document !== "undefined";
  const isVerifiedSeller =
    session?.user?.role === "SELLER" || session?.user?.role === "ADMIN";
  const isAdmin =
    session?.user?.role === "ADMIN" || isPrimaryAdminEmail(session?.user?.email);

  const navItems = useMemo(
    () => [
      { key: "market", label: "Market", href: "/listings" },
      { key: "live", label: "Live", href: "/live" },
      { label: "Trades", href: "/trades" },
      { label: "Forum", href: "/forum" },
      { label: "Messages", href: "/messages" },
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
          <div className="fixed inset-0 z-[999] pointer-events-auto md:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-slate-900/50"
              aria-label="Close menu"
              onClick={() => setMobileOpen(false)}
            />
            <div className="site-mobile-drawer fixed left-0 top-0 z-[1000] flex h-full w-[min(86vw,360px)] flex-col overflow-y-auto border-r border-white/70 bg-white/90 px-5 pb-6 pt-[calc(1.25rem+var(--safe-top))] shadow-[24px_0_60px_rgba(15,23,42,0.24)] backdrop-blur-xl">
              <div className="mb-5 flex items-center justify-between gap-3">
                <p className="font-display text-2xl text-slate-900">Menu</p>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700"
                >
                  Close
                </button>
              </div>
              <nav className="grid gap-3 text-lg font-semibold text-slate-800">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`rounded-2xl border px-4 py-3.5 transition ${
                      isNavActive(item)
                        ? "border-slate-800 bg-slate-900 text-white"
                        : "border-white/70 bg-white/70 text-slate-700"
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
                {isAdmin && (
                  <Link
                    href="/admin/sellers"
                    onClick={() => setMobileOpen(false)}
                    className="rounded-2xl border border-white/70 bg-white/70 px-4 py-3.5 text-slate-700"
                  >
                    Admin
                  </Link>
                )}
              </nav>
              <div className="mt-auto grid gap-3 pt-6">
                {session?.user?.id ? (
                  <button
                    onClick={() => {
                      void signOut();
                      setMobileOpen(false);
                    }}
                    className="rounded-full border border-slate-200 px-4 py-3 text-center text-base font-medium text-slate-700"
                  >
                    Sign out
                  </button>
                ) : (
                  <Link
                    href="/signin"
                    onClick={() => setMobileOpen(false)}
                    className="rounded-full border border-slate-200 px-4 py-3 text-center text-base font-medium text-slate-700"
                  >
                    Sign in
                  </Link>
                )}
                <Link
                  href={isVerifiedSeller ? "/sell" : "/seller/verification"}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-full bg-[var(--royal)] px-4 py-3.5 text-center text-base font-medium text-white"
                >
                  Create listing
                </Link>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <header className="site-header sticky top-0 z-50 border-b border-white/40 bg-white/80 backdrop-blur-xl">
        <div className="page-container flex items-center justify-between py-3 sm:py-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen((prev) => !prev)}
              className="site-menu-trigger inline-flex items-center justify-center rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 md:hidden"
              aria-expanded={mobileOpen}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
            >
              {mobileOpen ? "Close" : "Menu"}
            </button>
            <Brand />
          </div>

          <nav className="hidden items-center gap-5 text-sm font-medium text-slate-600 md:flex">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`site-nav-link transition hover:text-slate-900 ${isNavActive(item) ? "text-slate-900" : ""}`}
              >
                {item.label}
              </Link>
            ))}
            {isAdmin && (
              <Link
                href="/admin/sellers"
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600"
              >
                Admin
              </Link>
            )}
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <Link
              href={isVerifiedSeller ? "/sell" : "/seller/verification"}
              className="rounded-full bg-[var(--royal)] px-4 py-2 text-sm font-medium text-white shadow-lg shadow-black/25 transition hover:bg-[var(--royal-deep)]"
            >
              Create listing
            </Link>
            <UserMenu signedIn={Boolean(session?.user?.id)} />
          </div>
        </div>
      </header>
      {mobileDrawer}
    </>
  );
}
