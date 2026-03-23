import { headers } from "next/headers";
import { LiveHub } from "@/components/live/LiveHub";
import { isProbablyMobileUserAgent } from "@/lib/mobile";

export default async function LivePage() {
  const initialIsMobile = isProbablyMobileUserAgent((await headers()).get("user-agent"));

  return <LiveHub initialIsMobile={initialIsMobile} />;
}
