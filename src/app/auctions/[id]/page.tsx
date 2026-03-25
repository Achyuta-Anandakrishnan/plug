import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { isProbablyMobileUserAgent } from "@/lib/mobile";
import { getAuctionDetail } from "@/lib/server/auction-loaders";
import { AuctionDetailClient } from "@/components/auctions/AuctionDetailClient";

type Props = { params: Promise<{ id: string }> };

export default async function AuctionDetailPage({ params }: Props) {
  const { id } = await params;
  const auction = await getAuctionDetail(id);

  if (!auction) {
    redirect("/listings");
  }

  // If there's an active live stream session, redirect to the stream room
  const hasActiveStream = (auction.streamSessions ?? []).some(
    (s: { status: string }) => s.status === "LIVE" || s.status === "CREATED",
  );

  if (hasActiveStream) {
    redirect(`/streams/${id}`);
  }

  const ua = (await headers()).get("user-agent");
  const isMobile = isProbablyMobileUserAgent(ua);

  // TODO: render a dedicated non-stream AuctionDetailPage for marketplace listings
  return <AuctionDetailClient auction={auction} initialIsMobile={isMobile} />;
}
