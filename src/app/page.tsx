import Image from "next/image";
import Link from "next/link";
import {
  EmptyStateCard,
  PageContainer,
  PrimaryButton,
  SecondaryButton,
  SectionHeader,
} from "@/components/product/ProductUI";
import { formatCurrency, formatSeconds } from "@/lib/format";
import { getGradeLabel, getTimeLeftSeconds } from "@/lib/auctions";
import { auctions as mockAuctions } from "@/lib/mock";
import { resolveDisplayMediaUrl } from "@/lib/media-placeholders";
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

type HomePageData = {
  streams: HomeLiveStreamPreview[];
  auctions: HomeAuctionPreview[];
  trades: HomeTradePreview[];
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
    valueLabel: "$1,200-$1,600",
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
  {
    id: "demo-trade-3",
    href: "/trades",
    title: "Modern chase bundle",
    owner: "Vault Room",
    lookingFor: "Mainly high-end sports rookies.",
    offersCount: 5,
    valueLabel: "Up to $1,100",
    imageUrl: "/placeholders/pokemon-generic.svg",
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

async function getHomePageData(): Promise<HomePageData> {
  const [liveStreamsData, listingsData, tradesData] = await Promise.all([
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
      orderBy: [{ watchersCount: "desc" }, { createdAt: "desc" }],
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
      orderBy: [{ watchersCount: "desc" }, { createdAt: "desc" }],
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
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
  ]);

  const streams = mapStreams(liveStreamsData);
  const auctions = mapAuctions(listingsData);
  const trades = mapTrades(tradesData);

  return {
    streams: streams.length ? streams : FALLBACK_STREAMS,
    auctions: auctions.length ? auctions : mapFallbackAuctions(),
    trades: trades.length ? trades : FALLBACK_TRADES,
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
    <Link href={href} className={`home-surface-card${className ? ` ${className}` : ""}`}>
      <div className="home-surface-media">
        <Image src={imageUrl} alt={title} fill sizes="(max-width: 900px) 100vw, 380px" className="object-cover" unoptimized />
      </div>
      <div className="home-surface-body">
        <span className="home-surface-accent">{accent}</span>
        <h3>{title}</h3>
        <p>{subtitle}</p>
        <strong>{meta}</strong>
      </div>
    </Link>
  );
}

function HomeRouteCard({
  eyebrow,
  title,
  copy,
  href,
}: {
  eyebrow: string;
  title: string;
  copy: string;
  href: string;
}) {
  return (
    <Link href={href} className="home-route-card">
      <span className="home-pillar-kicker">{eyebrow}</span>
      <h3>{title}</h3>
      <p>{copy}</p>
      <strong>Open</strong>
    </Link>
  );
}

export default async function Home() {
  const data = await getHomePageData();
  const heroStream = data.streams[0];
  const heroAuction = data.auctions[0];
  const heroTrade = data.trades[0];
  const heroAuctionSecondary = data.auctions[1] ?? heroAuction;
  const heroTradeSecondary = data.trades[1] ?? heroTrade;
  const connectedCards = [
    ...data.auctions.slice(0, 2).map((auction) => ({
      title: auction.title,
      subtitle: `${auction.category}${auction.gradeLabel ? ` · ${auction.gradeLabel}` : ""}`,
      meta: `${auction.currentBidLabel} · ${auction.timeLeftLabel}`,
      imageUrl: auction.imageUrl,
      href: auction.href,
      accent: "Marketplace",
    })),
    ...data.streams.slice(0, 1).map((stream) => ({
      title: stream.title,
      subtitle: `${stream.host} · ${stream.category}`,
      meta: `${stream.watchers.toLocaleString()} watching · ${stream.priceLabel}`,
      imageUrl: stream.imageUrl,
      href: stream.href,
      accent: "Live",
    })),
    ...data.trades.slice(0, 1).map((trade) => ({
      title: trade.title,
      subtitle: trade.owner,
      meta: `${trade.valueLabel} · ${trade.offersCount} offers`,
      imageUrl: trade.imageUrl,
      href: trade.href,
      accent: "Trades",
    })),
  ];

  return (
    <PageContainer className="home-app-page">
      <section className="home-hero home-marketing-section">
        <div className="home-hero-copy">
          <p className="app-eyebrow">For collectors, by collectors</p>
          <h1>Live. Auctions. Trades.</h1>
          <p>
            One premium collectibles platform for real-time streams, live bidding, and structured collector deals.
          </p>
          <div className="home-hero-actions">
            <PrimaryButton href="/listings">Explore marketplace</PrimaryButton>
            <SecondaryButton href="/live">Watch live</SecondaryButton>
          </div>
          <div className="home-hero-notes">
            <span>Browse active inventory</span>
            <span>Join live rooms</span>
            <span>Negotiate collector deals</span>
          </div>
        </div>

        <div className="home-hero-stage">
          <SurfacePreview
            title={heroStream.title}
            subtitle={`${heroStream.host} · ${heroStream.category}`}
            meta={`${heroStream.watchers.toLocaleString()} watching · ${heroStream.priceLabel}`}
            imageUrl={heroStream.imageUrl}
            href={heroStream.href}
            accent="Live now"
            className="is-primary"
          />
          <div className="home-hero-side">
            <SurfacePreview
              title={heroAuction.title}
              subtitle={`${heroAuction.category} · ${heroAuction.seller}`}
              meta={`${heroAuction.currentBidLabel} · ${heroAuction.timeLeftLabel}`}
              imageUrl={heroAuction.imageUrl}
              href={heroAuction.href}
              accent="Auction"
              className="is-secondary"
            />
            <SurfacePreview
              title={heroTrade.title}
              subtitle={heroTrade.owner}
              meta={`${heroTrade.valueLabel} · ${heroTrade.offersCount} offers`}
              imageUrl={heroTrade.imageUrl}
              href={heroTrade.href}
              accent="Trade"
              className="is-secondary"
            />
            <SurfacePreview
              title={heroAuctionSecondary.title}
              subtitle={`${heroAuctionSecondary.category} · ${heroAuctionSecondary.seller}`}
              meta={`${heroAuctionSecondary.currentBidLabel} · ${heroAuctionSecondary.timeLeftLabel}`}
              imageUrl={heroAuctionSecondary.imageUrl}
              href={heroAuctionSecondary.href}
              accent="Market"
              className="is-tertiary"
            />
            <SurfacePreview
              title={heroTradeSecondary.title}
              subtitle={heroTradeSecondary.owner}
              meta={`${heroTradeSecondary.valueLabel} · ${heroTradeSecondary.offersCount} offers`}
              imageUrl={heroTradeSecondary.imageUrl}
              href={heroTradeSecondary.href}
              accent="Deal"
              className="is-tertiary"
            />
          </div>
        </div>
      </section>

      <section className="home-marketing-section">
        <SectionHeader
          title="Three core actions"
          subtitle="Move inventory the way the hobby already works."
        />
        <div className="home-pillars-grid">
          <article className="home-pillar-card">
            <span className="home-pillar-kicker">Live</span>
            <h3>Run high-signal streams with active bidding.</h3>
            <p>Browse hosts, join rooms, and buy in real time without leaving the product.</p>
          </article>
          <article className="home-pillar-card">
            <span className="home-pillar-kicker">Auctions</span>
            <h3>Compare cards fast and transact with confidence.</h3>
            <p>Search inventory, sort by urgency, and see bid movement without clutter.</p>
          </article>
          <article className="home-pillar-card">
            <span className="home-pillar-kicker">Trades</span>
            <h3>Negotiate collector-to-collector deals in a structured flow.</h3>
            <p>Value bands, offer counts, and messaging all stay in one place.</p>
          </article>
        </div>
      </section>

      <section className="home-marketing-section">
        <SectionHeader
          title="One connected product"
          subtitle="Market discovery, live commerce, and negotiation live in the same workflow."
        />
        <div className="home-connected-showcase">
          <SurfacePreview
            title={heroStream.title}
            subtitle={`${heroStream.host} · ${heroStream.category}`}
            meta={`${heroStream.watchers.toLocaleString()} watching · ${heroStream.priceLabel}`}
            imageUrl={heroStream.imageUrl}
            href={heroStream.href}
            accent="Featured room"
            className="is-featured"
          />
          <div className="home-connected-grid">
            {connectedCards.map((card) => (
              <SurfacePreview
                key={`${card.accent}-${card.title}`}
                title={card.title}
                subtitle={card.subtitle}
                meta={card.meta}
                imageUrl={card.imageUrl}
                href={card.href}
                accent={card.accent}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="home-marketing-section">
        <SectionHeader
          title="Why collectors trust dalow"
          subtitle="The product stays calm, direct, and transaction-focused."
        />
        <div className="home-trust-grid">
          <article className="home-trust-card">
            <h3>Collector-native structure</h3>
            <p>Live, auction, and trade flows are designed around how hobby inventory actually moves.</p>
          </article>
          <article className="home-trust-card">
            <h3>Clearer signals</h3>
            <p>Watchers, value bands, time pressure, and host identity stay visible without dashboard noise.</p>
          </article>
          <article className="home-trust-card">
            <h3>Built for confidence</h3>
            <p>Premium surfaces, tighter information hierarchy, and cleaner actions make deals feel higher trust.</p>
          </article>
        </div>
      </section>

      <section className="home-final-section home-marketing-section">
        <div className="home-final-cta-copy">
          <p className="app-eyebrow">Start where the moment begins</p>
          <h2>Browse inventory, join a room, or open a deal.</h2>
          <p>Each route should feel like a real product surface, not another empty scroll section.</p>
        </div>
        <div className="home-final-grid">
          <HomeRouteCard
            eyebrow="Marketplace"
            title="Browse listings and auctions"
            copy="Search active inventory, compare price movement, and move fast."
            href="/listings"
          />
          <HomeRouteCard
            eyebrow="Live"
            title="Join active rooms"
            copy="Watch hosts, read signals fast, and jump into the room with context."
            href="/live"
          />
          <HomeRouteCard
            eyebrow="Trades"
            title="Negotiate collector deals"
            copy="Open structured posts, review value bands, and message with purpose."
            href="/trades"
          />
        </div>
        <div className="home-final-cta-actions">
          <PrimaryButton href="/listings">Open marketplace</PrimaryButton>
          <SecondaryButton href="/live">Watch live</SecondaryButton>
        </div>
      </section>

      {data.streams.length === 0 && data.auctions.length === 0 && data.trades.length === 0 ? (
        <EmptyStateCard
          title="No previews available yet."
          description="Once inventory is live, dalow will surface stream, auction, and trade previews here."
        />
      ) : null}
    </PageContainer>
  );
}
