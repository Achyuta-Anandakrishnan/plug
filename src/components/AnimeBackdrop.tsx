"use client";

import { usePathname } from "next/navigation";

const SHOWCASE_ROUTES = new Set([
  "/",
  "/signin",
  "/signup",
  "/referral",
  "/seller/verification",
]);

export function AnimeBackdrop() {
  const pathname = usePathname();

  if (!pathname || !SHOWCASE_ROUTES.has(pathname)) {
    return null;
  }

  return (
    <div aria-hidden="true" className="anime-layer">
      <div className="anime-card anime-card-a" />
      <div className="anime-card anime-card-b" />
      <div className="anime-card anime-card-c" />
    </div>
  );
}
