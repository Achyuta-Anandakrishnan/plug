"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageSquare, Radio, ShoppingBag, Target } from "lucide-react";

const NAV_ITEMS = [
  { key: "market", label: "Market", href: "/listings", Icon: ShoppingBag },
  { key: "bounty", label: "Bounty", href: "/bounties", Icon: Target },
  { key: "live", label: "Live", href: "/live", Icon: Radio },
  { key: "forum", label: "Forum", href: "/forum", Icon: MessageSquare },
];

function isActive(pathname: string | null, href: string, key: string) {
  if (key === "market") {
    return pathname === "/listings"
      || pathname === "/explore"
      || pathname?.startsWith("/listings/")
      || pathname?.startsWith("/explore/")
      || pathname?.startsWith("/auctions/")
      || pathname === "/trades"
      || pathname?.startsWith("/trades/");
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
    <nav className="site-mobile-tabbar" aria-label="Primary navigation">
      {NAV_ITEMS.map(({ key, label, href, Icon }) => (
        <Link
          key={key}
          href={href}
          className={`site-mobile-tab${isActive(pathname, href, key) ? " is-active" : ""}`}
          aria-label={label}
        >
          <Icon aria-hidden="true" />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
