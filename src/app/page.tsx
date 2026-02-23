import Link from "next/link";
import { AuctionCard } from "@/components/AuctionCard";
import { LandingSlideshow } from "@/components/home/LandingSlideshow";
import { getSessionUser } from "@/lib/auth";
import { categories, auctions as mockAuctions } from "@/lib/mock";
import { prisma } from "@/lib/prisma";

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
  const sessionUser = await getSessionUser();
  const sellerProfile = sessionUser?.id
    ? await prisma.sellerProfile.findUnique({
        where: { userId: sessionUser.id },
        select: { status: true },
      })
    : null;

  const isVerifiedSeller = sellerProfile?.status === "APPROVED" || sessionUser?.role === "ADMIN";
  const featured = await getFeaturedAuctions();
  const items = featured.length ? featured : mockAuctions.slice(0, 6);

  return (
    <div className="space-y-12">
      <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-center">
        <div className="space-y-5">
          <h1 className="font-display text-4xl text-slate-900 sm:text-5xl lg:text-6xl">
            A better live marketplace for collectibles.
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
            Real-time streams, structured grading data, direct messaging, and trust-first controls in one workflow.
            Built for buyers and sellers who need speed without sacrificing safety.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/streams"
              className="rounded-full bg-[var(--royal)] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:bg-[var(--royal-deep)]"
            >
              Watch streams
            </Link>
            <Link
              href={isVerifiedSeller ? "/sell" : "/seller/verification"}
              className="rounded-full border border-slate-200 px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
            >
              {isVerifiedSeller ? "Create listing" : "Apply as seller"}
            </Link>
          </div>
        </div>

        <div className="glass-panel rounded-[28px] p-5">
          <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Why teams switch</p>
          <div className="mt-3 space-y-2 text-sm text-slate-600">
            <p>1. AI-assisted trust and quality scoring</p>
            <p>2. Faster conversion with live-native checkout</p>
            <p>3. Searchable profiles + direct buyer-seller messaging</p>
            <p>4. Grading-company-aware listing metadata</p>
          </div>
        </div>
      </section>

      <LandingSlideshow />

      <section className="space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Live now</p>
            <h2 className="font-display text-2xl text-slate-900">Featured streams</h2>
          </div>
          <Link href="/streams" className="text-sm font-semibold text-[var(--royal)]">
            View all
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((auction) => (
            <AuctionCard key={auction.id} {...auction} />
          ))}
        </div>
      </section>

      <section className="surface-panel rounded-[30px] p-6">
        <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Category coverage</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {categories.map((category) => (
            <div key={category.name} className="rounded-2xl border border-white/70 bg-white/70 px-4 py-3">
              <p className="text-sm font-semibold text-slate-900">{category.name}</p>
              <p className="mt-1 text-xs text-slate-500">{category.description}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
