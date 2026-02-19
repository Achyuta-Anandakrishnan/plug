"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useMobileUi } from "@/hooks/useMobileUi";
import { isPrimaryAdminEmail } from "@/lib/admin-email";

const ThemeToggle = dynamic(
  () => import("@/components/ThemeToggle").then((mod) => mod.ThemeToggle),
  { ssr: false },
);

const navItems = [
  { label: "Streams", href: "/streams" },
  { label: "Sell", href: "/sell" },
  { label: "Search", href: "/explore" },
  { label: "Forum", href: "/forum" },
  { label: "Seller Verification", href: "/seller/verification" },
  { label: "Messages", href: "/messages" },
  { label: "Settings", href: "/settings" },
];

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
  return (
    <>
      {signedIn ? (
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
      )}
      <Link
        href="/seller/verification"
        className="rounded-full bg-[var(--royal)] px-3.5 py-1.5 text-xs font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:bg-[var(--royal-deep)] sm:px-5 sm:py-2 sm:text-sm"
      >
        Go live
      </Link>
    </>
  );
}

export function SiteHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAdmin =
    session?.user?.role === "ADMIN" || isPrimaryAdminEmail(session?.user?.email);
  const isMobileUi = useMobileUi();

  useEffect(() => {
    if (!mobileOpen) return;
    const timeoutId = window.setTimeout(() => setMobileOpen(false), 0);
    return () => window.clearTimeout(timeoutId);
  }, [mobileOpen, pathname]);

  useEffect(() => {
    if (isMobileUi || !mobileOpen) return;
    const timeoutId = window.setTimeout(() => setMobileOpen(false), 0);
    return () => window.clearTimeout(timeoutId);
  }, [isMobileUi, mobileOpen]);

  return (
    <header className="sticky top-0 z-50 border-b border-white/40 bg-white/80 backdrop-blur-xl">
      <div className="page-container flex items-center justify-between py-4 sm:py-4">
        <Brand />

        {!isMobileUi && (
          <>
            <nav className="hidden items-center gap-5 text-sm font-medium text-slate-600 md:flex lg:gap-6">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="transition hover:text-slate-900"
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

            <div className="hidden items-center gap-2 sm:gap-3 md:flex md:gap-4">
              <ThemeToggle />
              <AccountActions signedIn={Boolean(session?.user?.id)} />
            </div>
          </>
        )}

        {isMobileUi && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileOpen((prev) => !prev)}
              className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300"
              aria-expanded={mobileOpen}
              aria-controls="mobile-nav"
            >
              {mobileOpen ? "Close" : "Menu"}
            </button>
          </div>
        )}
      </div>

      {isMobileUi && mobileOpen && (
        <div id="mobile-nav" className="border-t border-white/60 bg-white/90">
          <div className="page-container py-4">
            <div className="mb-3">
              <ThemeToggle />
            </div>
            <nav className="flex flex-col gap-3 text-sm font-medium text-slate-700">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-2xl border border-white/70 bg-white/70 px-4 py-3"
                >
                  {item.label}
                </Link>
              ))}
              {isAdmin && (
                <Link
                  href="/admin/sellers"
                  onClick={() => setMobileOpen(false)}
                  className="rounded-2xl border border-white/70 bg-white/70 px-4 py-3"
                >
                  Admin
                </Link>
              )}
            </nav>
            <div className="mt-4 grid gap-2">
              <AccountActions signedIn={Boolean(session?.user?.id)} />
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
