import { headers } from "next/headers";
import { SellerListingDesktop } from "@/components/sell/SellerListingDesktop";
import { SellerListingMobile } from "@/components/sell/SellerListingMobile";
import { isMobileUserAgent } from "@/lib/device";

export default async function SellPage() {
  const ua = (await headers()).get("user-agent");
  const isMobile = isMobileUserAgent(ua);

  return isMobile ? <SellerListingMobile /> : <SellerListingDesktop />;
}
