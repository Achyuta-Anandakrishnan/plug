"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  Bell,
  ChevronDown,
  Gift,
  LayoutList,
  LogOut,
  Mail,
  MessageSquare,
  Package,
  Radio,
  Settings,
  Shield,
  ShoppingBag,
  Target,
  User,
} from "lucide-react";
import { AppContainer } from "@/components/product/ProductUI";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { MOBILE_QUERY } from "@/hooks/useMobileUi";

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
  inboxHref?: string;
};

function AccountButton({ signedIn, isAdmin = false, mobile = false, inboxHref }: AccountButtonProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerClassName = mobile ? "site-account-trigger site-account-trigger-mobile" : "site-account-trigger";

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  if (!signedIn) {
    return (
      <Link href="/signin" className={triggerClassName}>
        <User size={13} strokeWidth={2.2} aria-hidden="true" />
        {mobile ? "Sign in" : "Sign in"}
      </Link>
    );
  }

  return (
    <div ref={ref} className={`site-account-menu${mobile ? " site-account-menu-mobile" : ""}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={triggerClassName}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <User size={13} strokeWidth={2.2} aria-hidden="true" />
        {mobile ? "You" : "Account"}
        <ChevronDown
          size={11}
          strokeWidth={2.5}
          aria-hidden="true"
          style={{ opacity: 0.6, transition: "transform 160ms ease", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>
      {open ? (
        <div
          className={`site-account-popover${mobile ? " site-account-popover-mobile" : ""}`}
          role="menu"
        >
          {inboxHref ? (
            <>
              <Link href={inboxHref} role="menuitem" onClick={() => setOpen(false)}>
                <Mail size={14} strokeWidth={1.8} aria-hidden="true" />
                Inbox
              </Link>
              <div className="popover-divider" />
            </>
          ) : null}
          <Link href="/my/listings" role="menuitem" onClick={() => setOpen(false)}>
            <LayoutList size={14} strokeWidth={1.8} aria-hidden="true" />
            My listings
          </Link>
          <div className="popover-divider" />
          <Link href="/settings" role="menuitem" onClick={() => setOpen(false)}>
            <Settings size={14} strokeWidth={1.8} aria-hidden="true" />
            Settings
          </Link>
          <Link href="/orders" role="menuitem" onClick={() => setOpen(false)}>
            <Package size={14} strokeWidth={1.8} aria-hidden="true" />
            Orders
          </Link>
          <Link href="/referral" role="menuitem" onClick={() => setOpen(false)}>
            <Gift size={14} strokeWidth={1.8} aria-hidden="true" />
            Referral
          </Link>
          {isAdmin ? (
            <>
              <div className="popover-divider" />
              <Link href="/admin/sellers" role="menuitem" onClick={() => setOpen(false)}>
                <Shield size={14} strokeWidth={1.8} aria-hidden="true" />
                Admin
              </Link>
            </>
          ) : null}
          <div className="popover-divider" />
          <button
            type="button"
            role="menuitem"
            className="is-destructive"
            onClick={() => { setOpen(false); void signOut(); }}
          >
            <LogOut size={14} strokeWidth={1.8} aria-hidden="true" />
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}

const DESKTOP_NAV_ITEMS = [
  { key: "market", label: "Market", href: "/listings", Icon: ShoppingBag },
  { key: "bounty", label: "Bounty", href: "/bounties", Icon: Target },
  { key: "live", label: "Live", href: "/live", Icon: Radio },
  { key: "forum", label: "Forum", href: "/forum", Icon: MessageSquare },
  { key: "messages", label: "Messages", href: "/messages", Icon: Mail },
];

function useSiteHeaderState() {
  const pathname = usePathname();
  const { data: session } = useSession();

  const isVerifiedSeller = session?.user?.role === "SELLER" || session?.user?.role === "ADMIN";
  const isAdmin = session?.user?.role === "ADMIN";

  const navItems = DESKTOP_NAV_ITEMS;

  const isNavActive = (item: (typeof navItems)[number]) => {
    if (item.key === "market") {
      return pathname === "/listings"
        || pathname === "/explore"
        || pathname?.startsWith("/listings/")
        || pathname?.startsWith("/explore/")
        || pathname?.startsWith("/auctions/")
        || pathname === "/trades"
        || pathname?.startsWith("/trades/");
    }
    if (item.key === "bounty") {
      return pathname === item.href || pathname?.startsWith(`${item.href}/`);
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
    // Hub pages: title lives in the in-page toolbar, not the header
    if (pathname === "/listings" || pathname === "/explore") return null;
    if (pathname === "/bounties") return null;
    if (pathname === "/live") return null;
    if (pathname === "/forum") return null;
    if (pathname === "/trades") return null;
    // Detail / sub-pages
    if (pathname.startsWith("/bounties/")) return pathname === "/bounties/new" ? "Post bounty" : "Bounty";
    if (pathname.startsWith("/listings/") || pathname.startsWith("/explore/")) return "Market";
    if (pathname.startsWith("/auctions/")) return "Listing";
    if (pathname.startsWith("/live/")) return "Live";
    if (pathname === "/streams/schedule") return "Schedule";
    if (pathname.startsWith("/streams/")) return "Live room";
    if (pathname === "/trades/new") return "New trade";
    if (pathname.startsWith("/trades/")) return "Trade";
    if (pathname === "/forum/new") return "Write thread";
    if (pathname.startsWith("/forum/")) return "Thread";
    if (pathname === "/messages" || pathname.startsWith("/messages/")) return "Inbox";
    if (pathname.startsWith("/my/")) return "My activity";
    if (pathname === "/sell") return "Create listing";
    if (pathname.startsWith("/settings")) return "Settings";
    if (pathname === "/orders") return "Orders";
    if (pathname === "/referral") return "Referral";
    if (pathname === "/seller/verification") return "Seller verification";
    if (pathname.startsWith("/profiles/") || pathname.startsWith("/u/")) return "Profile";
    if (pathname === "/signin") return "Sign in";
    if (pathname === "/signup") return "Create account";
    return null;
  }, [pathname]);

  const mobileBackHref = useMemo(() => {
    if (!pathname || pathname === "/") return null;
    if (pathname === "/forum/new") return "/forum";
    if (pathname.startsWith("/forum/")) return "/forum";
    if (pathname === "/bounties/new") return "/bounties";
    if (pathname.startsWith("/bounties/")) return "/bounties";
    if (pathname === "/trades/new") return "/trades";
    if (pathname.startsWith("/trades/")) return "/trades";
    if (pathname.startsWith("/streams/")) return "/live";
    if (pathname.startsWith("/auctions/")) return "/listings";
    if (pathname.startsWith("/my/")) return "/settings";
    if (pathname === "/referral" || pathname === "/orders") return "/settings";
    if (pathname.startsWith("/settings/")) return "/settings";
    if (pathname.startsWith("/profiles/") || pathname.startsWith("/u/")) return "/listings";
    return null;
  }, [pathname]);

  const isMobileTopLevel = useMemo(() => {
    if (!pathname) return true;
    return [
      "/",
      "/listings",
      "/explore",
      "/trades",
      "/bounties",
      "/live",
      "/forum",
      "/messages",
      "/settings",
      "/sell",
      "/signin",
      "/signup",
      "/referral",
    ].includes(pathname);
  }, [pathname]);

  return {
    isAdmin,
    isVerifiedSeller,
    isMobileTopLevel,
    mobileBackHref,
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
            {navItems.map(({ key, href, label, Icon }) => (
              <Link
                key={href}
                href={href}
                className={`site-nav-link${isNavActive({ key, href, label, Icon }) ? " is-active" : ""}`}
              >
                <Icon size={13} strokeWidth={1.9} aria-hidden="true" />
                {label}
              </Link>
            ))}
            {isAdmin ? (
              <Link href="/admin/sellers" className="site-admin-link">
                <Shield size={13} strokeWidth={1.9} aria-hidden="true" />
                Admin
              </Link>
            ) : null}
          </nav>

          <div className="site-header-actions">
            {isVerifiedSeller ? (
              <Link href="/sell" className="app-button app-button-primary">
                + List item
              </Link>
            ) : signedIn ? (
              <Link href="/seller/verification" className="app-button app-button-primary">
                Become a seller
              </Link>
            ) : (
              <Link href="/waitlist" className="app-button app-button-primary">
                Join Waitlist
              </Link>
            )}
            <AccountButton signedIn={signedIn} isAdmin={isAdmin} />
          </div>
        </div>
      </AppContainer>
    </header>
  );
}

export function SiteMobileHeader() {
  const { isAdmin, isMobileTopLevel, mobileBackHref, mobileTitle, signedIn } = useSiteHeaderState();

  return (
    <header className="site-header site-header-mobile">
      <div className="site-shell">
        <div className="site-header-row site-header-row-mobile">
          <div className="site-header-left">
            {isMobileTopLevel || !mobileBackHref ? (
              <Brand />
            ) : (
              <Link href={mobileBackHref} className="site-mobile-back">
                ← Back
              </Link>
            )}
          </div>

          {mobileTitle ? (
            <div className="site-mobile-title" aria-hidden="true">
              {mobileTitle}
            </div>
          ) : null}

          <div className="site-mobile-header-actions">
            <Link
              href="/messages"
              className="site-header-bell"
              aria-label="Inbox"
            >
              <Bell size={15} strokeWidth={2} aria-hidden="true" />
            </Link>
            <AccountButton signedIn={signedIn} isAdmin={isAdmin} mobile inboxHref="/messages" />
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
