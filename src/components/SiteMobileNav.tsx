"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowLeftRight, MessageSquare, Radio, ShoppingBag, Target } from "lucide-react";
import { isPrimaryAdminEmail } from "@/lib/admin-email";

const NAV_ITEMS = [
  { key: "market", label: "Market", href: "/listings", Icon: ShoppingBag },
  { key: "bounty", label: "Bounty", href: "/bounties", Icon: Target },
  { key: "live", label: "Live", href: "/live", Icon: Radio },
  { key: "trades", label: "Trades", href: "/trades", Icon: ArrowLeftRight },
  { key: "forum", label: "Forum", href: "/forum", Icon: MessageSquare },
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
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN" || isPrimaryAdminEmail(session?.user?.email);

  return (
    <nav className="site-mobile-tabbar" aria-label="Primary navigation">
      {NAV_ITEMS.map(({ key, label, href, Icon }) =>
        isAdmin ? (
          <Link
            key={key}
            href={href}
            className={`site-mobile-tab${isActive(pathname, href, key) ? " is-active" : ""}`}
            aria-label={label}
          >
            <Icon aria-hidden="true" />
            <span>{label}</span>
          </Link>
        ) : (
          <span
            key={key}
            className="site-mobile-tab site-mobile-tab-disabled"
            aria-disabled="true"
            aria-label={label}
          >
            <Icon aria-hidden="true" />
            <span>{label}</span>
          </span>
        )
      )}
    </nav>
  );
}
