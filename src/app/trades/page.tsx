import { headers } from "next/headers";
import { TradesPageClient } from "@/components/trades/TradesPageClient";
import { isProbablyMobileUserAgent } from "@/lib/mobile";

export default async function TradesPage() {
  const initialIsMobile = isProbablyMobileUserAgent((await headers()).get("user-agent"));

  return <TradesPageClient initialIsMobile={initialIsMobile} />;
}
