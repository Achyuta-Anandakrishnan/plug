import Link from "next/link";
import { AppContainer } from "@/components/product/ProductUI";
import { StreamRoomResponsive } from "@/components/streams/StreamRoomResponsive";
import type { AuctionDetail } from "@/hooks/useAuction";

export default async function StreamRoom({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let initialData: AuctionDetail | null = null;
  const stripeReady = Boolean(process.env.STRIPE_SECRET_KEY);

  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/auctions/${id}`,
      { cache: "no-store" },
    );
    if (response.ok) {
      initialData = (await response.json()) as AuctionDetail;
    }
  } catch {
    initialData = null;
  }

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
