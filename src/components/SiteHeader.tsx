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
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/90 shadow-lg shadow-blue-500/20 sm:h-10 sm:w-10">
        <Image src="/vyre-mark.svg" alt="Vyre logo" width={28} height={28} />
      </div>
      <div>
        <p className="font-display text-xl text-slate-900 sm:text-lg">Vyre</p>
      </div>
    </Link>
  );
}

function BellIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 17h5l-1.4-1.4a2 2 0 0 1-.6-1.4V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" />
      <path d="M9.5 19a2.5 2.5 0 0 0 5 0" />
    </svg>
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
    return [
      { label: "Streams", href: "/streams" },
      { label: "Listings", href: "/listings" },
      { label: "Search", href: "/explore" },
      { label: "Forum", href: "/forum" },
      { label: "Messages", href: "/messages" },
      { label: "Settings", href: "/settings" },
    ];
  }, []);

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
          <div className="fixed left-0 top-0 z-[1000] flex h-full w-[min(86vw,360px)] flex-col overflow-y-auto border-r border-white/70 bg-white/95 px-5 pb-6 pt-[calc(1.25rem+var(--safe-top))] shadow-[24px_0_60px_rgba(15,23,42,0.24)] backdrop-blur-xl">
            <div className="mb-5 flex items-center justify-between gap-3">
              <p className="font-display text-2xl text-slate-900">Menu</p>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600"
              >
                Close
              </button>
            </div>
            <div className="mb-5">
              <ThemeToggle />
            </div>
            <nav className="grid gap-3 text-lg font-semibold text-slate-800">
              {navItems.map((item) => (
                <Link
                  key={item.href + item.label}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`rounded-2xl border px-4 py-3.5 transition ${
                    pathname === item.href || pathname?.startsWith(`${item.href}/`)
                      ? "border-blue-100 bg-blue-50 text-[var(--royal)]"
                      : "border-white/70 bg-white/80"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
              {isAdmin && (
                <Link
                  href="/admin/profiles"
                  onClick={() => setMobileOpen(false)}
                  className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3.5"
                >
                  Admin
                </Link>
              )}
            </nav>
            <div className="mt-auto grid gap-3 pt-6">
              <AccountActions signedIn={Boolean(session?.user?.id)} />
              <Link
                href={isVerifiedSeller ? "/sell" : "/seller/verification"}
                onClick={() => setMobileOpen(false)}
                className="rounded-full bg-[var(--royal)] px-4 py-3.5 text-center text-base font-semibold text-white"
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
        <div className="page-container flex items-center justify-between py-3 sm:py-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen((prev) => !prev)}
              className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 md:hidden"
              aria-expanded={mobileOpen}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
            >
              {mobileOpen ? "Close" : "Menu"}
            </button>
            <Brand />
          </div>

          <nav className="hidden items-center gap-5 text-sm font-medium text-slate-600 md:flex lg:gap-6">
            {navItems.map((item) => (
              <Link key={item.href + item.label} href={item.href} className="transition hover:text-slate-900">
                {item.label}
              </Link>
            ))}
            {isAdmin && (
              <Link
                href="/admin/profiles"
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600"
              >
                Admin
              </Link>
            )}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
            <div className="hidden md:block">
              <ThemeToggle />
            </div>

            <div className="hidden md:flex md:items-center md:gap-3">
              <Link
                href="/messages"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                aria-label="Messages"
                title="Messages"
              >
                <BellIcon />
              </Link>
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
      {mobileDrawer}
    </>
  );
}
