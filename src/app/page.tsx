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

function HeroDiagram() {
  return (
    <svg viewBox="0 0 280 140" className="h-32 w-full" aria-hidden="true">
      <defs>
        <linearGradient id="heroLineA" x1="0%" x2="100%" y1="0%" y2="0%">
          <stop offset="0%" stopColor="rgba(59,130,246,0.92)" />
          <stop offset="100%" stopColor="rgba(147,197,253,0.92)" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="280" height="140" rx="18" fill="rgba(255,255,255,0.52)" />
      <path d="M16 106 L56 94 L96 96 L136 68 L176 61 L216 46 L264 28" stroke="url(#heroLineA)" strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d="M16 118 L60 110 L104 103 L148 90 L192 82 L236 74 L264 68" stroke="rgba(30,64,175,0.35)" strokeWidth="3" fill="none" strokeLinecap="round" />
      <circle cx="264" cy="28" r="6" fill="rgba(30,64,175,0.95)" />
    </svg>
  );
}

export default async function Home() {
  const featured = await getFeaturedAuctions();
  const items = featured.length ? featured : mockAuctions.slice(0, 6);

  return (
    <div className="ios-screen">
      <section className="ios-hero grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-center">
        <div className="space-y-5">
          <h1 className="ios-title">Bid. Buy. Stream.</h1>
          <p className="ios-subtitle">
            Clean flow. Verified sellers. Fast checkout.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/streams"
              className="rounded-full bg-[var(--royal)] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:bg-[var(--royal-deep)]"
            >
              Watch streams
            </Link>
            <Link
              href="/listings"
              className="rounded-full border border-slate-200 bg-white/90 px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
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

        <div className="ios-panel p-4">
          <p className="ios-kicker">Flow map</p>
          <div className="mt-3 space-y-3">
            <HeroDiagram />
            <div className="grid grid-cols-3 gap-2 text-[11px] uppercase tracking-[0.16em] text-slate-600">
              <span className="rounded-xl bg-white/70 px-2 py-2 text-center">Live</span>
              <span className="rounded-xl bg-white/70 px-2 py-2 text-center">Chat</span>
              <span className="rounded-xl bg-white/70 px-2 py-2 text-center">Checkout</span>
            </div>
          </div>
        </div>
      </section>

      <LandingSlideshow />

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="ios-kicker">Live now</p>
            <h2 className="ios-section-title">Featured cards</h2>
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
        <div className="flex items-center justify-between gap-4">
          <p className="ios-kicker">Categories</p>
          <Link href="/explore" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Explore
          </Link>
        </div>
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
