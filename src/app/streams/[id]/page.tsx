import Link from "next/link";
import { AppContainer } from "@/components/product/ProductUI";
import { StreamRoomResponsive } from "@/components/streams/StreamRoomResponsive";
import type { AuctionDetail } from "@/hooks/useAuction";
import { getAuctionDetail } from "@/lib/server/auction-loaders";

export default async function StreamRoom({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const stripeReady = Boolean(process.env.STRIPE_SECRET_KEY);
  const initialData = await getAuctionDetail(id) as AuctionDetail | null;

  return (
    <AppContainer className="stream-room-page">
      <section className="stream-room-head">
        <div className="stream-room-head-copy">
          <Link href="/live" className="stream-room-back">
            Back to live
          </Link>
          <h1>Live stream</h1>
        </div>
        <div className="stream-room-pills">
          <span>Escrow protected</span>
          <span>Manual verification</span>
        </div>
      </section>

      <StreamRoomResponsive
        auctionId={id}
        initialData={initialData}
        stripeEnabled={stripeReady}
      />
    </AppContainer>
  );
}
