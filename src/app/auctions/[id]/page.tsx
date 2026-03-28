import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { isProbablyMobileUserAgent } from "@/lib/mobile";
import { getAuctionDetail } from "@/lib/server/auction-loaders";
import { fetchPsaCertificateSnapshot, type PsaCertificateSnapshot } from "@/lib/psa-cert";
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
  const attributes = auction.item?.attributes && typeof auction.item.attributes === "object" && !Array.isArray(auction.item.attributes)
    ? (auction.item.attributes as Record<string, unknown>)
    : null;
  const certNumber = typeof attributes?.certNumber === "string" ? attributes.certNumber.trim() : "";
  const grader = typeof attributes?.grader === "string"
    ? attributes.grader.trim()
    : typeof attributes?.gradingCompany === "string"
      ? attributes.gradingCompany.trim()
      : "";
  let certSnapshot: PsaCertificateSnapshot | null = null;
  if (certNumber && (!grader || grader.toUpperCase() === "PSA")) {
    certSnapshot = await fetchPsaCertificateSnapshot({
      certNumber,
      itemName: auction.title,
      category: auction.category?.name,
    }).catch(() => null);
  }

  // TODO: render a dedicated non-stream AuctionDetailPage for marketplace listings
  return <AuctionDetailClient auction={auction} initialIsMobile={isMobile} certSnapshot={certSnapshot} />;
}
