import { headers } from "next/headers";
import { WantBoardClient } from "@/components/wants/WantBoardClient";
import { isProbablyMobileUserAgent } from "@/lib/mobile";

export default async function WantsPage() {
  const initialIsMobile = isProbablyMobileUserAgent((await headers()).get("user-agent"));

  return <WantBoardClient initialIsMobile={initialIsMobile} />;
}
