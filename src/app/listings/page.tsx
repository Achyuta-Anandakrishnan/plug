import { headers } from "next/headers";
import { MarketHub } from "@/components/market/MarketHub";
import { isProbablyMobileUserAgent } from "@/lib/mobile";

export default async function ListingsPage() {
  const initialIsMobile = isProbablyMobileUserAgent((await headers()).get("user-agent"));

  return <MarketHub initialIsMobile={initialIsMobile} />;
}
