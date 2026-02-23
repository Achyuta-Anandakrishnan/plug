"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { isPrimaryAdminEmail } from "@/lib/admin-email";

const ThemeToggle = dynamic(
  () => import("@/components/ThemeToggle").then((mod) => mod.ThemeToggle),
  { ssr: false },
);

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white/90 shadow-lg shadow-blue-500/20 sm:h-10 sm:w-10">
        <Image src="/vyre-mark.svg" alt="Vyre logo" width={28} height={28} />
      </div>
      <div>
        <p className="font-display text-base text-slate-900 sm:text-lg">Vyre</p>
        <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500 sm:text-xs sm:tracking-[0.28em]">
          Verified Live Sales
        </p>
      </div>
    </Link>
  );
}

function AccountActions({ signedIn }: { signedIn: boolean }) {
  return signedIn ? (
    <button
      onClick={() => signOut()}
      className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 sm:px-4 sm:py-2 sm:text-sm"
    >
      Sign out
    </button>
  ) : (
    <Link
      href="/signin"
      className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 sm:px-4 sm:py-2 sm:text-sm"
    >
      Sign in
    </Link>
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

  const navItems = useMemo(() => {
    const items = [
      { label: "Streams", href: "/streams" },
      { label: "Listings", href: "/listings" },
      { label: "Search", href: "/explore" },
      { label: "Forum", href: "/forum" },
      { label: "Messages", href: "/messages" },
      { label: "Settings", href: "/settings" },
    ];
    items.splice(2, 0, isVerifiedSeller
      ? { label: "Sell", href: "/sell" }
      : { label: "Seller Verification", href: "/seller/verification" });
    return items;
  }, [isVerifiedSeller]);

  const mobilePrimaryItems = [
    { label: "Streams", href: "/streams" },
    { label: "Listings", href: "/listings" },
    { label: "Search", href: "/explore" },
    { label: "Forum", href: "/forum" },
  ];

  useEffect(() => {
    if (!canUseDom) return;
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [canUseDom, mobileOpen]);

  const mobileDrawer = canUseDom && mobileOpen
    ? createPortal(
        <div className="fixed inset-0 z-[999] pointer-events-auto md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/45"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
          <div className="fixed bottom-0 left-0 right-0 z-[1000] max-h-[84vh] overflow-y-auto rounded-t-3xl border-t border-white/70 bg-white p-4 shadow-[0_-24px_60px_rgba(15,23,42,0.24)]">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Menu</p>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600"
              >
                Close
              </button>
            </div>
            <div className="mb-3">
              <ThemeToggle />
            </div>
            <nav className="grid gap-2 text-sm font-medium text-slate-700">
              {navItems.map((item) => (
                <Link
                  key={item.href + item.label}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3"
                >
                  {item.label}
                </Link>
              ))}
              {isAdmin && (
                <Link
                  href="/admin/sellers"
                  onClick={() => setMobileOpen(false)}
                  className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3"
                >
                  Admin
                </Link>
              )}
            </nav>
            <div className="mt-4 grid gap-2">
              <AccountActions signedIn={Boolean(session?.user?.id)} />
              <Link
                href={isVerifiedSeller ? "/sell" : "/seller/verification"}
                onClick={() => setMobileOpen(false)}
                className="rounded-full bg-[var(--royal)] px-4 py-3 text-center text-sm font-semibold text-white"
              >
                {isVerifiedSeller ? "Create listing" : "Get verified"}
              </Link>
            </div>
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-white/40 bg-white/80 backdrop-blur-xl">
        <div className="page-container flex items-center justify-between py-4 sm:py-4">
          <Brand />

          <nav className="hidden items-center gap-5 text-sm font-medium text-slate-600 md:flex lg:gap-6">
            {navItems.map((item) => (
              <Link key={item.href + item.label} href={item.href} className="transition hover:text-slate-900">
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

          <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
            <button
              type="button"
              onClick={() => setMobileOpen((prev) => !prev)}
              className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 md:hidden"
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? "Close" : "Menu"}
            </button>

            <div className="hidden md:block">
              <ThemeToggle />
            </div>

            <div className="hidden md:flex md:items-center md:gap-3">
              <AccountActions signedIn={Boolean(session?.user?.id)} />
              <Link
                href={isVerifiedSeller ? "/sell" : "/seller/verification"}
                className="rounded-full bg-[var(--royal)] px-3.5 py-1.5 text-xs font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:bg-[var(--royal-deep)] sm:px-5 sm:py-2 sm:text-sm"
              >
                {isVerifiedSeller ? "Create listing" : "Get verified"}
              </Link>
            </div>
          </div>
        </div>
      </header>
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/60 bg-white/95 backdrop-blur md:hidden">
        <div className="grid grid-cols-5">
          {mobilePrimaryItems.map((item) => {
            const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`px-1 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.16em] ${
                  active ? "text-[var(--royal)]" : "text-slate-500"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="px-1 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500"
          >
            More
          </button>
        </div>
      </nav>
      {mobileDrawer}
    </>
  );
}
