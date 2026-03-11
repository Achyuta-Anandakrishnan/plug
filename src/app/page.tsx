import Link from "next/link";
import { AuctionCard } from "@/components/AuctionCard";
import { LandingSlideshow } from "@/components/home/LandingSlideshow";
import { auctions as mockAuctions } from "@/lib/mock";

type FeaturedCard = {
  id: string;
  title: string;
  sellerName: string;
  category: string;
  currentBid: number;
  timeLeft: number;
  watchers: number;
  badge: string;
  imageUrl: string | null;
  listingType: "AUCTION" | "BUY_NOW" | "BOTH";
  buyNowPrice?: number;
  currency: string;
};

async function getFeaturedAuctions(): Promise<FeaturedCard[]> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/auctions?status=LIVE&limit=6`,
      { cache: "no-store" },
    );
    if (!response.ok) return [];

    const now = Date.now();
    const featured = (await response.json()) as Array<{
      id: string;
      title: string;
      currentBid: number;
      endTime: string | null;
      extendedTime: string | null;
      watchersCount: number;
      listingType: "AUCTION" | "BUY_NOW" | "BOTH";
      buyNowPrice: number | null;
      currency: string;
      category?: { name: string } | null;
      seller?: { user?: { displayName: string | null } | null; status?: string } | null;
      item?: { images: { url: string; isPrimary: boolean }[] } | null;
    }>;

    return featured.map((auction) => ({
      id: auction.id,
      title: auction.title,
      sellerName: auction.seller?.user?.displayName ?? "Verified seller",
      category: auction.category?.name ?? "Collectible",
      currentBid: auction.currentBid,
      timeLeft: auction.extendedTime || auction.endTime
        ? Math.max(
            0,
            Math.floor(
              (new Date(auction.extendedTime ?? auction.endTime ?? 0).getTime() - now) / 1000,
            ),
          )
        : 0,
      watchers: auction.watchersCount,
      badge: auction.seller?.status === "APPROVED" ? "Verified" : "Live",
      imageUrl:
        auction.item?.images.find((img) => img.isPrimary)?.url
        ?? auction.item?.images[0]?.url
        ?? null,
      listingType: auction.listingType,
      buyNowPrice: auction.buyNowPrice ?? undefined,
      currency: auction.currency?.toUpperCase() ?? "USD",
    }));
  } catch {
    return [];
  }
}

export default async function Home() {
  const featured = await getFeaturedAuctions();
  const items = featured.length ? featured : mockAuctions.slice(0, 6);

  return (
    <div className="ios-screen">
      <section className="ios-hero grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center">
        <div className="space-y-5">
          <h1 className="ios-title">Bid. Buy. Stream.</h1>
          <p className="ios-subtitle">
            Fast checkout. Clean layout.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/listings?mode=streams"
              className="rounded-full bg-[var(--royal)] px-6 py-3 text-sm font-semibold text-white transition"
            >
              Watch streams
            </Link>
            <Link
              href="/listings"
              className="rounded-full border border-slate-300 bg-white/90 px-6 py-3 text-sm font-semibold text-slate-700 transition"
            >
              Open listings
            </Link>
          </div>
          <div className="ios-stat-grid">
            <div className="ios-stat-card">
              <p className="ios-stat-label">Live rooms</p>
              <p className="ios-stat-value">24/7</p>
            </div>
            <div className="ios-stat-card">
              <p className="ios-stat-label">Mode</p>
              <p className="ios-stat-value">Minimal</p>
            </div>
          </div>
        </div>

        <div className="ios-panel p-3">
          <div className="landing-checker relative h-44 overflow-hidden rounded-2xl border border-white/70">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.28),transparent_58%)]" />
            <div className="absolute left-3 top-3 rounded-full border border-white/50 bg-black/50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white">
              Live board
            </div>
          </div>
        </div>
      </section>

      <LandingSlideshow />

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="ios-section-title">Featured</h2>
          <Link href="/listings" className="text-sm font-semibold text-[var(--royal)]">
            View all
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4">
          {items.map((auction) => (
            <AuctionCard key={auction.id} {...auction} />
          ))}
        </div>
      </section>
    </div>
  );
}
