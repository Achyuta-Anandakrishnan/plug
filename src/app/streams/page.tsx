import { headers } from "next/headers";
import { StreamsDesktop } from "@/components/streams/StreamsDesktop";
import { StreamsMobile } from "@/components/streams/StreamsMobile";
import { isMobileUserAgent } from "@/lib/device";

export default async function StreamsPage() {
  const ua = (await headers()).get("user-agent");
  const isMobile = isMobileUserAgent(ua);

  return isMobile ? <StreamsMobile /> : <StreamsDesktop />;
}
