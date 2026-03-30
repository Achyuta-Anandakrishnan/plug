import { headers } from "next/headers";
import { AppContainer } from "@/components/product/ProductUI";
import { StreamRoomResponsive } from "@/components/streams/StreamRoomResponsive";
import type { AuctionDetail } from "@/hooks/useAuction";
import { isProbablyMobileUserAgent } from "@/lib/mobile";
import { getAuctionDetail } from "@/lib/server/auction-loaders";

export default async function StreamRoom({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const initialIsMobile = isProbablyMobileUserAgent((await headers()).get("user-agent"));
  const stripeReady = Boolean(process.env.STRIPE_SECRET_KEY);
  const initialData = await getAuctionDetail(id) as AuctionDetail | null;

  return (
    <AppContainer className="stream-room-v4-page">
      <StreamRoomResponsive
        auctionId={id}
        initialData={initialData}
        stripeEnabled={stripeReady}
        initialIsMobile={initialIsMobile}
      />
    </AppContainer>
  );
}
