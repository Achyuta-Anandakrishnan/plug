import { headers } from "next/headers";
import { BountyBoardClient } from "@/components/bounties/BountyBoardClient";
import { isProbablyMobileUserAgent } from "@/lib/mobile";

export default async function BountiesPage() {
  const initialIsMobile = isProbablyMobileUserAgent((await headers()).get("user-agent"));

  return <BountyBoardClient initialIsMobile={initialIsMobile} />;
}
