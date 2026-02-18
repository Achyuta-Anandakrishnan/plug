"use client";

import { SellerListingDesktop } from "@/components/sell/SellerListingDesktop";
import { SellerListingMobile } from "@/components/sell/SellerListingMobile";
import { useIsMobileViewport } from "@/hooks/useIsMobileViewport";

export function SellResponsive() {
  const isMobile = useIsMobileViewport();
  return isMobile ? <SellerListingMobile /> : <SellerListingDesktop />;
}

