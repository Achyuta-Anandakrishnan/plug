"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { key: "market", label: "Market", href: "/listings" },
  { key: "bounty", label: "Bounty", href: "/bounties" },
  { key: "live", label: "Live", href: "/live" },
  { key: "trades", label: "Trades", href: "/trades" },
  { key: "forum", label: "Forum", href: "/forum" },
  { key: "messages", label: "Inbox", href: "/messages" },
];

function isActive(pathname: string | null, href: string, key: string) {
  if (key === "market") {
    return pathname === "/listings"
      || pathname === "/explore"
      || pathname?.startsWith("/listings/")
      || pathname?.startsWith("/explore/")
      || pathname?.startsWith("/auctions/");
  }
  if (key === "bounty") {
    return pathname === href || pathname?.startsWith(`${href}/`);
  }
  if (key === "live") {
    return pathname === href
      || pathname?.startsWith(`${href}/`)
      || pathname?.startsWith("/streams/");
  }
  return pathname === href || pathname?.startsWith(`${href}/`);
}

export function SiteMobileNav() {
  const pathname = usePathname();

  return (
    <nav className="site-mobile-tabbar md:hidden" aria-label="Primary">
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          className={`site-mobile-tab ${isActive(pathname, item.href, item.key) ? "is-active" : ""}`}
        >
          <span>{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
