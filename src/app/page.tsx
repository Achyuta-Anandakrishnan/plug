import Link from "next/link";
import { AuctionCard } from "@/components/AuctionCard";
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
              (new Date(auction.extendedTime ?? auction.endTime ?? 0).getTime() -
                now) /
                1000,
            ),
          )
        : 0,
      watchers: auction.watchersCount,
      badge: auction.seller?.status === "APPROVED" ? "Verified" : "Live",
      imageUrl:
        auction.item?.images.find((img) => img.isPrimary)?.url ??
        auction.item?.images[0]?.url ??
        "/streams/stream-1.svg",
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
    <div className="space-y-16">
      <section className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
        <div className="space-y-6">
          <p className="text-xs uppercase tracking-[0.34em] text-slate-400">
            Verified live commerce
          </p>
          <h1 className="font-display text-4xl text-slate-900 sm:text-5xl lg:text-6xl">
            Premium live streams built for trusted sales.
          </h1>
          <p className="max-w-xl text-lg leading-relaxed text-slate-600 sm:text-base">
            Verified sellers, escrow protection, and on-stream proof so every
            transaction feels as safe as in-person.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link
              href="/streams"
              className="rounded-full bg-[var(--royal)] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:bg-[var(--royal-deep)]"
            >
              Watch live streams
            </Link>
            <Link
              href={isVerifiedSeller ? "/sell" : "/seller/verification"}
              className="rounded-full border border-slate-200 px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
            >
              {isVerifiedSeller ? "Create listing" : "Become a verified seller"}
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { label: "Escrow protected", value: "100%" },
              { label: "Manual vetting", value: "Every seller" },
              { label: "Stream logs", value: "Secure archive" },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-white/70 bg-white/70 px-4 py-3 text-xs text-slate-500"
              >
                <p className="font-display text-lg text-slate-900">{item.value}</p>
                <p className="uppercase tracking-[0.2em]">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="glass-panel rounded-[32px] p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
            Trust snapshot
          </p>
          <h2 className="font-display text-2xl text-slate-900">
            Dual-camera verification, on-stream.
          </h2>
          <p className="mt-3 text-sm text-slate-600">
            Every listing includes live proof of condition, serials, and packing
            checks before escrow releases.
          </p>
          <div className="mt-5 grid gap-3 text-xs text-slate-500">
            <div className="flex items-center justify-between rounded-2xl bg-white/70 px-4 py-3">
              <span>Inventory audit</span>
              <span className="font-semibold text-slate-800">Required</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-white/70 px-4 py-3">
              <span>Live proof window</span>
              <span className="font-semibold text-slate-800">Recorded</span>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                Live now
              </p>
              <h2 className="font-display text-2xl text-slate-900">
                Featured streams
              </h2>
            </div>
          <Link
            href="/streams"
            className="text-sm font-semibold text-[var(--royal)]"
          >
            View all
          </Link>
        </div>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {items.map((auction) => (
            <AuctionCard key={auction.id} {...auction} />
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
            Trust stack
          </p>
          <h2 className="font-display text-2xl text-slate-900">
            Designed for high-value live sales.
          </h2>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {[
            {
              title: "Escrow protection",
              detail:
                "Funds stay locked until delivery confirmation and authenticity review.",
            },
            {
              title: "Manual seller vetting",
              detail:
                "Inventory audits, identity checks, and live readiness walkthroughs.",
            },
            {
              title: "Recorded proof",
              detail:
                "Every stream moment is logged for disputes and buyer reassurance.",
            },
          ].map((item) => (
            <div key={item.title} className="surface-panel rounded-[28px] p-6">
              <p className="font-display text-lg text-slate-900">{item.title}</p>
              <p className="mt-2 text-sm text-slate-600">{item.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="surface-panel rounded-[32px] p-8">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
              Categories
            </p>
            <h3 className="font-display text-2xl text-slate-900">
              Category studios are next.
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              We are rolling out vertical-first experiences for each category.
            </p>
          </div>
          <Link
            href="/streams"
            className="rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white"
          >
            Explore roadmaps
          </Link>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {categories.map((category) => (
            <div
              key={category.name}
              className="rounded-2xl border border-white/70 bg-white/70 px-4 py-3"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                {category.name}
              </p>
              <p className="text-xs text-slate-500">{category.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="surface-panel rounded-[32px] p-8">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
            Short-form highlights
          </p>
          <h3 className="font-display text-2xl text-slate-900">
            Instant clips from every stream.
          </h3>
          <p className="mt-2 text-sm text-slate-600">
            Turn live moments into verified shoppable clips and share them in
            minutes.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <span className="rounded-full bg-blue-50 px-4 py-2 text-xs font-semibold text-[var(--royal)]">
              Coming Q3
            </span>
            <span className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-slate-600">
              Auto-captioning
            </span>
            <span className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-slate-600">
              Creator splits
            </span>
          </div>
        </div>
        <div className="glass-panel rounded-[32px] p-8">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
            Referral program
          </p>
          <h3 className="font-display text-2xl text-slate-900">
            Bring trusted sellers. Earn faster payouts.
          </h3>
          <p className="mt-2 text-sm text-slate-600">
            Invite vetted sellers and unlock lower fees plus boosted visibility.
          </p>
          <Link
            href="/referral"
            className="mt-6 inline-flex rounded-full bg-[var(--royal)] px-5 py-2 text-sm font-semibold text-white"
          >
            Build your referral link
          </Link>
        </div>
      </section>
    </div>
  );
}
