import Link from "next/link";
import { AuctionCard } from "@/components/AuctionCard";
import { LandingSlideshow } from "@/components/home/LandingSlideshow";
import { categories, auctions as mockAuctions } from "@/lib/mock";

type FeaturedCard = {
  id: string;
  title: string;
  sellerName: string;
  category: string;
  currentBid: number;
  timeLeft: number;
  watchers: number;
  badge: string;
  imageUrl: string;
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
        ?? "/streams/stream-1.svg",
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
      <section className="ios-hero grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-center">
        <div className="space-y-5">
          <p className="ios-kicker">Trusted live marketplace</p>
          <h1 className="ios-title">
            The cleanest place to buy and sell live.
          </h1>
          <p className="ios-subtitle">
            Every seller is reviewed by hand. Every live room is tied to a real listing.
            Every transaction is built for clarity, speed, and buyer confidence.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/streams"
              className="rounded-full bg-[var(--royal)] px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:bg-[var(--royal-deep)]"
            >
              Watch streams
            </Link>
            <Link
              href="/listings"
              className="rounded-full border border-slate-200 bg-white/90 px-6 py-3.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
            >
              Browse listings
            </Link>
          </div>
        </div>

        <div className="ios-panel p-5">
          <p className="ios-kicker">Why sellers move here</p>
          <div className="mt-3 space-y-2 text-sm text-slate-600">
            <p>1. Manual seller review before anyone can go live</p>
            <p>2. Cleaner listings that convert faster on stream</p>
            <p>3. Direct buyer to seller messaging with real identity attached</p>
            <p>4. Secure checkout flow built around trust, not noise</p>
          </div>
        </div>
      </section>

      <LandingSlideshow />

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="ios-kicker">Live now</p>
            <h2 className="ios-section-title">Featured streams</h2>
          </div>
          <Link href="/streams" className="text-sm font-semibold text-[var(--royal)]">
            View all
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {items.map((auction) => (
            <AuctionCard key={auction.id} {...auction} />
          ))}
        </div>
      </section>

      <section className="ios-panel p-5 sm:p-6">
        <p className="ios-kicker">Category coverage</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {categories.map((category) => (
            <div key={category.name} className="ios-panel-muted rounded-[22px] px-4 py-4">
              <p className="text-sm font-semibold text-slate-900">{category.name}</p>
              <p className="mt-1 text-xs text-slate-500">{category.description}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
