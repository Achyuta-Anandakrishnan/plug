import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import { LandingLayoutSwitch } from "@/components/home/LandingLayoutSwitch";
import { LandingSearchBar } from "@/components/home/LandingSearchBar";
import {
  EmptyStateCard,
  PageContainer,
  PrimaryButton,
} from "@/components/product/ProductUI";
import { formatCurrency, formatSeconds } from "@/lib/format";
import { getGradeLabel, getTimeLeftSeconds } from "@/lib/auctions";
import { auctions as mockAuctions } from "@/lib/mock";
import { resolveDisplayMediaUrl } from "@/lib/media-placeholders";
import { isProbablyMobileUserAgent } from "@/lib/mobile";
import { prisma } from "@/lib/prisma";
import { tradeValueLabel } from "@/lib/trade-client";

type AuctionApiItem = {
  id: string;
  title: string;
  endTime: string | Date | null;
  extendedTime: string | Date | null;
  currentBid: number;
  watchersCount: number;
  listingType: "AUCTION" | "BUY_NOW" | "BOTH";
  buyNowPrice: number | null;
  currency: string;
  category?: { name: string } | null;
  createdAt?: string | Date;
  seller?: {
    status?: string;
    user?: { displayName: string | null; id: string } | null;
  } | null;
  item?: {
    attributes?: unknown;
    images: { url: string; isPrimary: boolean }[];
  } | null;
};

type TradeApiItem = {
  id: string;
  title: string;
  lookingFor: string;
  valueMin: number | null;
  valueMax: number | null;
  owner: {
    displayName: string | null;
    username: string | null;
  };
  images: Array<{
    url: string;
    isPrimary: boolean;
  }>;
  _count: {
    offers: number;
  };
};

type BountyApiItem = {
  id: string;
  title: string;
  itemName: string;
  priceMin: number | null;
  priceMax: number | null;
  bountyAmount: number | null;
  category: string | null;
  player: string | null;
  setName: string | null;
  year: string | null;
  gradeCompany: string | null;
  grade: string | null;
};

type HomeLiveStreamPreview = {
  id: string;
  href: string;
  title: string;
  host: string;
  category: string;
  watchers: number;
  priceLabel: string;
  imageUrl: string;
};

type HomeAuctionPreview = {
  id: string;
  href: string;
  title: string;
  seller: string;
  category: string;
  currentBidLabel: string;
  timeLeftLabel: string;
  imageUrl: string;
  gradeLabel: string | null;
};

type HomeTradePreview = {
  id: string;
  href: string;
  title: string;
  owner: string;
  lookingFor: string;
  offersCount: number;
  valueLabel: string;
  imageUrl: string;
};

type HomeBountyPreview = {
  id: string;
  href: string;
  itemName: string;
  budgetLabel: string;
  bountyLabel: string | null;
  meta: string;
};

type HomePageData = {
  streams: HomeLiveStreamPreview[];
  auctions: HomeAuctionPreview[];
  trades: HomeTradePreview[];
  bounties: HomeBountyPreview[];
};

const FALLBACK_STREAMS: HomeLiveStreamPreview[] = [
  {
    id: "demo-live-1",
    href: "/live",
    title: "PSA slabs live break",
    host: "dalow studio",
    category: "Pokemon",
    watchers: 124,
    priceLabel: "Bid $420",
    imageUrl: "/placeholders/pokemon-generic.svg",
  },
  {
    id: "demo-live-2",
    href: "/live",
    title: "Vintage sports singles",
    host: "Collector room",
    category: "Sports",
    watchers: 88,
    priceLabel: "Bid $185",
    imageUrl: "/placeholders/pokemon-generic.svg",
  },
];

const FALLBACK_TRADES: HomeTradePreview[] = [
  {
    id: "demo-trade-1",
    href: "/trades",
    title: "PSA 10 Pikachu promo",
    owner: "Collector One",
    lookingFor: "Looking for vintage holos or sealed product.",
    offersCount: 3,
    valueLabel: "$1,200–$1,600",
    imageUrl: "/placeholders/pokemon-generic.svg",
  },
  {
    id: "demo-trade-2",
    href: "/trades",
    title: "2003 Ex Dragon lot",
    owner: "Card Archive",
    lookingFor: "Open to graded trades and partial cash.",
    offersCount: 2,
    valueLabel: "From $850",
    imageUrl: "/placeholders/pokemon-generic.svg",
  },
];

const FALLBACK_BOUNTIES: HomeBountyPreview[] = [
  {
    id: "demo-bounty-1",
    href: "/bounties",
    itemName: "PSA 10 1999 Base Charizard",
    budgetLabel: "$8,000–$12,000",
    bountyLabel: "$500",
    meta: "Pokemon · Graded",
  },
  {
    id: "demo-bounty-2",
    href: "/bounties",
    itemName: "BGS 9.5 Mike Trout Rookie",
    budgetLabel: "Up to $4,200",
    bountyLabel: "$200",
    meta: "Sports · BGS",
  },
];

function validImage(url: string | null | undefined) {
  if (!url) return "/placeholders/pokemon-generic.svg";
  if (url.startsWith("/")) return url;
  if (/^https?:\/\//i.test(url)) return url;
  return "/placeholders/pokemon-generic.svg";
}

function primaryAuctionImage(item: AuctionApiItem) {
  return item.item?.images.find((entry) => entry.isPrimary)?.url ?? item.item?.images[0]?.url ?? null;
}

function mapStreams(items: AuctionApiItem[] | null): HomeLiveStreamPreview[] {
  if (!items?.length) return [];
  return items.slice(0, 6).map((stream) => {
    const currency = stream.currency?.toUpperCase() || "USD";
    const priceLabel = stream.buyNowPrice && stream.buyNowPrice > 0
      ? `Buy ${formatCurrency(stream.buyNowPrice, currency)}`
      : `Bid ${formatCurrency(stream.currentBid, currency)}`;
    return {
      id: stream.id,
      href: `/streams/${stream.id}`,
      title: stream.title,
      host: stream.seller?.user?.displayName ?? "Verified seller",
      category: stream.category?.name ?? "Collectibles",
      watchers: stream.watchersCount,
      priceLabel,
      imageUrl: validImage(resolveDisplayMediaUrl(primaryAuctionImage(stream))),
    };
  });
}

function mapAuctions(items: AuctionApiItem[] | null): HomeAuctionPreview[] {
  const source = items?.length ? items : [];
  return source
    .filter((entry) => entry.listingType !== "BUY_NOW")
    .slice(0, 6)
    .map((auction) => {
      const currency = auction.currency?.toUpperCase() || "USD";
      const gradeLabel = getGradeLabel(
        (auction.item?.attributes ?? null) as Record<string, unknown> | null,
      );
      return {
        id: auction.id,
        href: `/auctions/${auction.id}`,
        title: auction.title,
        seller: auction.seller?.user?.displayName ?? "Verified seller",
        category: auction.category?.name ?? "Collectibles",
        currentBidLabel: formatCurrency(auction.currentBid, currency),
        timeLeftLabel: formatSeconds(getTimeLeftSeconds(auction)),
        imageUrl: validImage(resolveDisplayMediaUrl(primaryAuctionImage(auction))),
        gradeLabel,
      };
    });
}

function mapTrades(items: TradeApiItem[] | null): HomeTradePreview[] {
  if (!items?.length) return [];
  return items.slice(0, 6).map((trade) => ({
    id: trade.id,
    href: `/trades/${trade.id}`,
    title: trade.title,
    owner: trade.owner.displayName ?? trade.owner.username ?? "Collector",
    lookingFor: trade.lookingFor,
    offersCount: trade._count.offers,
    valueLabel: tradeValueLabel(trade.valueMin, trade.valueMax),
    imageUrl: validImage(trade.images.find((entry) => entry.isPrimary)?.url ?? trade.images[0]?.url),
  }));
}

function mapBounties(items: BountyApiItem[] | null): HomeBountyPreview[] {
  if (!items?.length) return [];
  return items.slice(0, 4).map((b) => {
    const budget = b.priceMin != null && b.priceMax != null
      ? `${formatCurrency(b.priceMin)} – ${formatCurrency(b.priceMax)}`
      : b.priceMax != null
      ? `Up to ${formatCurrency(b.priceMax)}`
      : b.priceMin != null
      ? `From ${formatCurrency(b.priceMin)}`
      : "Open budget";
    const metaParts = [b.category, b.player, b.setName, b.year, b.gradeCompany && b.grade ? `${b.gradeCompany} ${b.grade}` : null]
      .filter(Boolean)
      .slice(0, 3);
    return {
      id: b.id,
      href: `/bounties/${b.id}`,
      itemName: b.itemName || b.title,
      budgetLabel: budget,
      bountyLabel: b.bountyAmount ? formatCurrency(b.bountyAmount) : null,
      meta: metaParts.join(" · ") || "Collector request",
    };
  });
}

function mapFallbackAuctions(): HomeAuctionPreview[] {
  return mockAuctions.slice(0, 6).map((auction) => ({
    id: auction.id,
    href: "/listings?mode=auctions",
    title: auction.title,
    seller: auction.sellerName,
    category: auction.category,
    currentBidLabel: formatCurrency(auction.currentBid, auction.currency),
    timeLeftLabel: formatSeconds(auction.timeLeft),
    imageUrl: validImage(resolveDisplayMediaUrl(auction.imageUrl)),
    gradeLabel: null,
  }));
}

function classNames(...parts: Array<string | null | undefined | false>) {
  return parts.filter(Boolean).join(" ");
}

async function getHomePageData(): Promise<HomePageData> {
  const [liveStreamsData, listingsData, tradesData, bountiesData] = await Promise.all([
    prisma.auction.findMany({
      where: {
        status: "LIVE",
        streamSessions: { some: { status: "LIVE" } },
      },
      include: {
        category: true,
        item: { include: { images: true } },
        seller: {
          select: {
            status: true,
            user: { select: { displayName: true, id: true } },
          },
        },
      },
      orderBy: [{ watchersCount: "desc" }, { currentBid: "desc" }, { createdAt: "desc" }],
      take: 6,
    }),
    prisma.auction.findMany({
      where: {
        status: "LIVE",
        streamSessions: { none: { status: "LIVE" } },
      },
      include: {
        category: true,
        item: { include: { images: true } },
        seller: {
          select: {
            status: true,
            user: { select: { displayName: true, id: true } },
          },
        },
      },
      orderBy: [{ watchersCount: "desc" }, { currentBid: "desc" }, { createdAt: "desc" }],
      take: 6,
    }),
    prisma.tradePost.findMany({
      where: { status: "OPEN" },
      include: {
        owner: {
          select: {
            displayName: true,
            username: true,
          },
        },
        images: {
          orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
        },
        _count: {
          select: { offers: true },
        },
      },
      orderBy: [{ offers: { _count: "desc" } }, { createdAt: "desc" }],
      take: 6,
    }),
    prisma.wantRequest.findMany({
      where: { status: "OPEN" },
      select: {
        id: true,
        title: true,
        itemName: true,
        priceMin: true,
        priceMax: true,
        bountyAmount: true,
        category: true,
        player: true,
        setName: true,
        year: true,
        gradeCompany: true,
        grade: true,
      },
      orderBy: [{ bountyAmount: "desc" }, { updatedAt: "desc" }],
      take: 4,
    }),
  ]);

  const streams = mapStreams(liveStreamsData);
  const auctions = mapAuctions(listingsData);
  const trades = mapTrades(tradesData);
  const bounties = mapBounties(bountiesData);

  return {
    streams: streams.length ? streams : FALLBACK_STREAMS,
    auctions: auctions.length ? auctions : mapFallbackAuctions(),
    trades: trades.length ? trades : FALLBACK_TRADES,
    bounties: bounties.length ? bounties : FALLBACK_BOUNTIES,
  };
}

function SurfacePreview({
  title,
  subtitle,
  meta,
  imageUrl,
  href,
  accent,
  className,
}: {
  title: string;
  subtitle: string;
  meta: string;
  imageUrl: string;
  href: string;
  accent: string;
  className?: string;
}) {
  return (
    <Link href={href} className={classNames("landing-visual-card", className)}>
      <div className="landing-visual-media">
        <Image src={imageUrl} alt={title} fill sizes="(max-width: 900px) 100vw, 380px" className="object-cover" unoptimized />
      </div>
      <div className="landing-visual-overlay">
        <span className="landing-visual-badge">{accent}</span>
        <div className="landing-visual-copy">
          <h3>{title}</h3>
          <p>{subtitle}</p>
          <strong>{meta}</strong>
        </div>
      </div>
    </Link>
  );
}

function BountyHeroCard({
  bounty,
  className,
}: {
  bounty: HomeBountyPreview;
  className?: string;
}) {
  return (
    <Link href={bounty.href} className={classNames("landing-bounty-hero-card", className)}>
      <span className="landing-visual-badge">Bounty</span>
      <div className="landing-bounty-hero-body">
        <p className="landing-bounty-hero-name">{bounty.itemName}</p>
        <p className="landing-bounty-hero-meta">{bounty.meta}</p>
      </div>
      <div className="landing-bounty-hero-pricing">
        <div>
          <span className="landing-bounty-hero-label">Budget</span>
          <strong className="landing-bounty-hero-value">{bounty.budgetLabel}</strong>
        </div>
        {bounty.bountyLabel && (
          <div>
            <span className="landing-bounty-hero-label">Finder&rsquo;s fee</span>
            <strong className="landing-bounty-hero-value landing-bounty-hero-fee">{bounty.bountyLabel}</strong>
          </div>
        )}
      </div>
    </Link>
  );
}

function HomeActionColumn({
  eyebrow,
  title,
  copy,
}: {
  eyebrow: string;
  title: string;
  copy: string;
  href?: string;
}) {
  return (
    <div className="landing-action-column">
      <span className="landing-section-kicker">{eyebrow}</span>
      <h3>{title}</h3>
      <p>{copy}</p>
    </div>
  );
}

function HomeStoryStep({
  index,
  title,
  copy,
}: {
  index: string;
  title: string;
  copy: string;
}) {
  return (
    <li className="landing-story-point">
      <span className="landing-story-marker" aria-hidden="true">{index}</span>
      <div>
        <strong>{title}</strong>
        <p>{copy}</p>
      </div>
    </li>
  );
}

function HomeTrustPoint({
  title,
  copy,
}: {
  title: string;
  copy: string;
}) {
  return (
    <article className="landing-trust-point">
      <h3>{title}</h3>
      <p>{copy}</p>
    </article>
  );
}

export default async function Home() {
  const initialIsMobile = isProbablyMobileUserAgent((await headers()).get("user-agent"));
  const data = await getHomePageData();
  const heroStream = data.streams[0];
  const heroAuction = data.auctions[0];
  const heroTrade = data.trades[0];
  const heroBounty = data.bounties[0];
  const heroAuctionSecondary = data.auctions[1] ?? heroAuction;

  return (
    <PageContainer className="landing-page">
      <LandingLayoutSwitch
        initialIsMobile={initialIsMobile}
        desktop={(
          <div className="landing-desktop-layout">

            {/* ── Hero ──────────────────────────────────────────────────── */}
            <section className="landing-section landing-hero">
              <div className="landing-hero-copy">
                <p className="landing-eyebrow">For collectors, by collectors</p>
                <LandingSearchBar />
                <h1>Live. Auctions.<br />Trades. Bounties.</h1>
                <p>
                  One premium collectibles platform for real-time streams, live bidding, structured deals, and demand-led buying.
                </p>
                <div className="landing-hero-actions">
                  <PrimaryButton href="/waitlist">Join Waitlist</PrimaryButton>
                </div>
                <p className="landing-hero-note">Browse active inventory. Join live rooms. Negotiate collector deals.</p>
              </div>

              <div className="landing-hero-showcase">
                <div className="landing-hero-showcase-shell" aria-hidden="true" />
                <SurfacePreview
                  title={heroStream.title}
                  subtitle={`${heroStream.host} · ${heroStream.category}`}
                  meta={`${heroStream.watchers.toLocaleString()} watching · ${heroStream.priceLabel}`}
                  imageUrl={heroStream.imageUrl}
                  href={heroStream.href}
                  accent="Live now"
                  className="landing-showcase-card is-hero-featured"
                />
                <SurfacePreview
                  title={heroAuction.title}
                  subtitle={`${heroAuction.category} · ${heroAuction.seller}`}
                  meta={`${heroAuction.currentBidLabel} · ${heroAuction.timeLeftLabel}`}
                  imageUrl={heroAuction.imageUrl}
                  href={heroAuction.href}
                  accent="Auction"
                  className="landing-showcase-card is-hero-auction"
                />
                <SurfacePreview
                  title={heroTrade.title}
                  subtitle={heroTrade.owner}
                  meta={`${heroTrade.valueLabel} · ${heroTrade.offersCount} offers`}
                  imageUrl={heroTrade.imageUrl}
                  href={heroTrade.href}
                  accent="Trade"
                  className="landing-showcase-card is-hero-trade"
                />
                <BountyHeroCard
                  bounty={heroBounty}
                  className="landing-showcase-card is-hero-bounty"
                />
              </div>
            </section>

            {/* ── Core actions ──────────────────────────────────────────── */}
            <section className="landing-section landing-actions-section">
              <div className="landing-actions-strip">
                <HomeActionColumn
                  eyebrow="Live"
                  title="Sell in real time."
                  copy="Run stream rooms with live auctions. Collectors bid as you present."
                  href="/live"
                />
                <HomeActionColumn
                  eyebrow="Auctions"
                  title="Bid. Win."
                  copy="Timed auctions on graded singles, lots, and sealed product."
                  href="/listings"
                />
                <HomeActionColumn
                  eyebrow="Trades"
                  title="Deal direct."
                  copy="Post what you have. Browse what collectors want. Make offers."
                  href="/trades"
                />
                <HomeActionColumn
                  eyebrow="Bounty"
                  title="Name your price."
                  copy="Post exactly what you want. Put a finder's fee on it. Sellers bring it to you."
                  href="/bounties"
                />
              </div>
            </section>

            {/* ── Workflow story ────────────────────────────────────────── */}
            <section className="landing-section landing-story">
              <div className="landing-story-visual">
                <SurfacePreview
                  title={heroAuction.title}
                  subtitle={`${heroAuction.category} · ${heroAuction.seller}`}
                  meta={`${heroAuction.currentBidLabel} · ${heroAuction.timeLeftLabel}`}
                  imageUrl={heroAuction.imageUrl}
                  href={heroAuction.href}
                  accent="Active auction"
                  className="landing-story-card is-story-primary"
                />
                <div className="landing-story-stack">
                  <SurfacePreview
                    title={heroStream.title}
                    subtitle={`${heroStream.host} · ${heroStream.category}`}
                    meta={`${heroStream.watchers.toLocaleString()} watching · ${heroStream.priceLabel}`}
                    imageUrl={heroStream.imageUrl}
                    href={heroStream.href}
                    accent="Live floor"
                    className="landing-story-card is-story-secondary"
                  />
                  <SurfacePreview
                    title={heroAuctionSecondary.title}
                    subtitle={`${heroAuctionSecondary.category} · ${heroAuctionSecondary.seller}`}
                    meta={`${heroAuctionSecondary.currentBidLabel} · ${heroAuctionSecondary.timeLeftLabel}`}
                    imageUrl={heroAuctionSecondary.imageUrl}
                    href={heroAuctionSecondary.href}
                    accent="Ending soon"
                    className="landing-story-card is-story-secondary"
                  />
                </div>
              </div>
              <div className="landing-story-copy">
                <p className="landing-section-kicker">How it works</p>
                <h2>Discover. Bid. Trade. Pull supply.</h2>
                <p>
                  Every mode connects. Move inventory through the workflow that fits — sell live, run auctions, negotiate trades, or let bounties bring supply to you.
                </p>
                <ul className="landing-story-points">
                  <HomeStoryStep
                    index="01"
                    title="Discover"
                    copy="Browse active listings, live rooms, and open trades in a single feed."
                  />
                  <HomeStoryStep
                    index="02"
                    title="Bid"
                    copy="Jump into live auctions or timed listings. Prices move in real time."
                  />
                  <HomeStoryStep
                    index="03"
                    title="Trade"
                    copy="Make or receive structured offers. No guesswork, no DMs."
                  />
                  <HomeStoryStep
                    index="04"
                    title="Pull supply"
                    copy="Post a bounty with a finder's fee. Sellers bring the card to you."
                  />
                </ul>
              </div>
            </section>

            {/* ── Why it works ─────────────────────────────────────────── */}
            <section className="landing-section landing-trust">
              <div className="landing-section-head">
                <p className="landing-section-kicker">Why it works</p>
                <h2>Built for how the hobby moves.</h2>
              </div>
              <div className="landing-trust-grid">
                <HomeTrustPoint
                  title="Visual-first"
                  copy="See it fast. Listings are image-led with grade, cert, and condition surfaced up front."
                />
                <HomeTrustPoint
                  title="Real-time"
                  copy="Prices move live. Rooms, watchers, and bids create momentum you can feel."
                />
                <HomeTrustPoint
                  title="Structured"
                  copy="No messy DMs. Offers, trades, and deals are tied to the item with a clear record."
                />
                <HomeTrustPoint
                  title="Demand-led"
                  copy="Bounties pull inventory. Post what you want, set a finder's fee, and let the market come to you."
                />
                <HomeTrustPoint
                  title="Reputation"
                  copy="Your identity as a seller, buyer, and trader carries across every surface."
                />
              </div>
            </section>

            {/* ── Final CTA ────────────────────────────────────────────── */}
            <section className="landing-section landing-final">
              <div className="landing-final-actions">
                <PrimaryButton href="/listings">Start exploring</PrimaryButton>
              </div>
            </section>

          </div>
        )}
        mobile={(
          <div className="landing-mobile-layout">

            {/* ── Mobile hero ──────────────────────────────────────────── */}
            <section className="landing-mobile-section landing-mobile-hero">
              <p className="landing-eyebrow">For collectors, by collectors</p>
              <h1>Live. Auctions.<br />Trades. Bounties.</h1>
              <p className="landing-mobile-copy">
                One premium platform for real-time streams, live bidding, structured deals, and demand-led buying.
              </p>
              <div className="landing-mobile-actions">
                <PrimaryButton href="/waitlist">Join Waitlist</PrimaryButton>
              </div>
              <p className="landing-mobile-note">Browse active inventory. Join live rooms. Negotiate deals.</p>
            </section>

            {/* ── Mobile preview cards ─────────────────────────────────── */}
            <section className="landing-mobile-section landing-mobile-preview">
              <div className="landing-mobile-preview-stack">
                <SurfacePreview
                  title={heroStream.title}
                  subtitle={`${heroStream.host} · ${heroStream.category}`}
                  meta={`${heroStream.watchers.toLocaleString()} watching · ${heroStream.priceLabel}`}
                  imageUrl={heroStream.imageUrl}
                  href={heroStream.href}
                  accent="Live"
                  className="landing-mobile-preview-card is-live"
                />
                <SurfacePreview
                  title={heroAuction.title}
                  subtitle={`${heroAuction.category} · ${heroAuction.seller}`}
                  meta={`${heroAuction.currentBidLabel} · ${heroAuction.timeLeftLabel}`}
                  imageUrl={heroAuction.imageUrl}
                  href={heroAuction.href}
                  accent="Auction"
                  className="landing-mobile-preview-card is-auction"
                />
                <SurfacePreview
                  title={heroTrade.title}
                  subtitle={heroTrade.owner}
                  meta={`${heroTrade.valueLabel} · ${heroTrade.offersCount} offers`}
                  imageUrl={heroTrade.imageUrl}
                  href={heroTrade.href}
                  accent="Trade"
                  className="landing-mobile-preview-card is-trade"
                />
              </div>
            </section>

            {/* ── Mobile core actions ──────────────────────────────────── */}
            <section className="landing-mobile-section landing-mobile-actions-section">
              <div className="landing-mobile-action-grid">
                <HomeActionColumn eyebrow="Live" title="Sell in real time." copy="Stream rooms with live auctions." href="/live" />
                <HomeActionColumn eyebrow="Auctions" title="Bid. Win." copy="Timed listings on graded cards." href="/listings" />
                <HomeActionColumn eyebrow="Trades" title="Deal direct." copy="Post, offer, negotiate." href="/trades" />
                <HomeActionColumn eyebrow="Bounty" title="Name your price." copy="Post demand. Get supply." href="/bounties" />
              </div>
            </section>

            {/* ── Mobile workflow ──────────────────────────────────────── */}
            <section className="landing-mobile-section landing-mobile-story">
              <div className="landing-mobile-head">
                <p className="landing-section-kicker">How it works</p>
                <h2>Discover. Bid. Trade. Pull supply.</h2>
              </div>
              <SurfacePreview
                title={heroAuction.title}
                subtitle={`${heroAuction.category} · ${heroAuction.seller}`}
                meta={`${heroAuction.currentBidLabel} · ${heroAuction.timeLeftLabel}`}
                imageUrl={heroAuction.imageUrl}
                href={heroAuction.href}
                accent="Active"
                className="landing-mobile-story-card"
              />
              <ul className="landing-mobile-story-points">
                <HomeStoryStep index="01" title="Discover" copy="Browse listings, live rooms, and trades in one place." />
                <HomeStoryStep index="02" title="Bid" copy="Jump in. Prices move live." />
                <HomeStoryStep index="03" title="Trade" copy="Structured offers. No guesswork." />
                <HomeStoryStep index="04" title="Pull supply" copy="Bounties bring cards to you." />
              </ul>
            </section>

            {/* ── Mobile final ─────────────────────────────────────────── */}
            <section className="landing-mobile-section landing-mobile-final">
              <div className="landing-mobile-actions">
                <PrimaryButton href="/listings">Start exploring</PrimaryButton>
              </div>
            </section>

          </div>
        )}
      />

      {data.streams.length === 0 && data.auctions.length === 0 && data.trades.length === 0 ? (
        <EmptyStateCard
          title="No previews available yet."
          description="Once inventory is live, dalow will surface stream, auction, and trade previews here."
        />
      ) : null}
    </PageContainer>
  );
}
