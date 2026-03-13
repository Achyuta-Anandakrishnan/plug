import Image from "next/image";
import Link from "next/link";
import {
  EmptyStateCard,
  PageContainer,
  PrimaryButton,
  SecondaryButton,
  SectionHeader,
  StatPill,
} from "@/components/product/ProductUI";
import { formatCurrency, formatSeconds } from "@/lib/format";
import { getGradeLabel, getTimeLeftSeconds } from "@/lib/auctions";
import { auctions as mockAuctions } from "@/lib/mock";
import { resolveDisplayMediaUrl } from "@/lib/media-placeholders";
import { tradeValueLabel } from "@/lib/trade-client";

type AuctionApiItem = {
  id: string;
  title: string;
  endTime: string | null;
  extendedTime: string | null;
  currentBid: number;
  watchersCount: number;
  listingType: "AUCTION" | "BUY_NOW" | "BOTH";
  buyNowPrice: number | null;
  currency: string;
  category?: { name: string } | null;
  seller?: {
    status?: string;
    user?: { displayName: string | null; id: string } | null;
  } | null;
  item?: {
    attributes?: Record<string, unknown> | null;
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

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

function validImage(url: string | null | undefined) {
  if (!url) return "/placeholders/pokemon-generic.svg";
  if (url.startsWith("/")) return url;
  if (/^https?:\/\//i.test(url)) return url;
  return "/placeholders/pokemon-generic.svg";
}

function primaryAuctionImage(item: AuctionApiItem) {
  return item.item?.images.find((entry) => entry.isPrimary)?.url ?? item.item?.images[0]?.url ?? null;
}

async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${appUrl()}${path}`, { cache: "no-store" });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
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
      const gradeLabel = getGradeLabel(auction.item?.attributes);
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
    fetchJson<AuctionApiItem[]>("/api/auctions?status=LIVE&view=streams&limit=6"),
    fetchJson<AuctionApiItem[]>("/api/auctions?status=LIVE&view=listings&limit=6"),
    fetchJson<TradeApiItem[]>("/api/trades?limit=6"),
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
}: {
  title: string;
  subtitle: string;
  meta: string;
  imageUrl: string;
  href: string;
  accent: string;
}) {
  return (
    <Link href={href} className="home-surface-card">
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

function HomeSignalCard({
  eyebrow,
  title,
  copy,
}: {
  eyebrow: string;
  title: string;
  copy: string;
}) {
  return (
    <article className="home-signal-card">
      <span className="home-pillar-kicker">{eyebrow}</span>
      <h3>{title}</h3>
      <p>{copy}</p>
    </article>
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
  const heroPreviewCards = [
    {
      title: heroStream.title,
      subtitle: `${heroStream.host} · ${heroStream.category}`,
      meta: `${heroStream.watchers.toLocaleString()} watching · ${heroStream.priceLabel}`,
      imageUrl: heroStream.imageUrl,
      href: heroStream.href,
      accent: "Live now",
    },
    {
      title: heroAuction.title,
      subtitle: `${heroAuction.category} · ${heroAuction.seller}`,
      meta: `${heroAuction.currentBidLabel} · ${heroAuction.timeLeftLabel}`,
      imageUrl: heroAuction.imageUrl,
      href: heroAuction.href,
      accent: "Auction",
    },
    {
      title: heroTrade.title,
      subtitle: heroTrade.owner,
      meta: `${heroTrade.valueLabel} · ${heroTrade.offersCount} offers`,
      imageUrl: heroTrade.imageUrl,
      href: heroTrade.href,
      accent: "Trade",
    },
    {
      title: (data.streams[1] ?? heroStream).title,
      subtitle: `${(data.streams[1] ?? heroStream).host} · ${(data.streams[1] ?? heroStream).category}`,
      meta: `${(data.streams[1] ?? heroStream).watchers.toLocaleString()} watching · ${(data.streams[1] ?? heroStream).priceLabel}`,
      imageUrl: (data.streams[1] ?? heroStream).imageUrl,
      href: (data.streams[1] ?? heroStream).href,
      accent: "Room",
    },
  ];
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
      <section className="home-scroll-section home-hero">
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
          <div className="home-hero-stats">
            <StatPill label="Core modes" value="3 connected surfaces" />
            <StatPill label="Marketplace" value="Live listings and auctions" />
            <StatPill label="Collectors" value="Built for negotiation and trust" />
          </div>
        </div>

        <div className="home-hero-preview-grid">
          {heroPreviewCards.map((card) => (
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
      </section>

      <section className="home-scroll-section home-section-shell home-pillars-section">
        <div className="home-section-intro">
          <SectionHeader title="Three core actions" subtitle="Move inventory the way the hobby already works." />
          <p className="home-section-note">
            The product should read fast: go live, compare inventory, or negotiate value.
          </p>
        </div>
        <div className="home-section-body">
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
          <div className="home-signal-grid">
            <HomeSignalCard
              eyebrow="Live signal"
              title="Hosts, watchers, and bid state stay visible."
              copy="You should understand the room before you click into it."
            />
            <HomeSignalCard
              eyebrow="Market signal"
              title="Listings sort around urgency, not filler."
              copy="Collectors can compare price, time pressure, and format immediately."
            />
            <HomeSignalCard
              eyebrow="Trade signal"
              title="Offers feel structured instead of improvised."
              copy="Value bands, tags, and owner context stay attached to the post."
            />
          </div>
        </div>
      </section>

      <section className="home-scroll-section home-section-shell home-connected-section">
        <div className="home-section-intro">
          <SectionHeader title="One connected product" subtitle="Market discovery, live commerce, and negotiation live in the same workflow." />
          <p className="home-section-note">
            Inventory, rooms, and trades should feel like one product family instead of separate modules.
          </p>
        </div>
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
      </section>

      <section className="home-scroll-section home-section-shell home-trust-section">
        <div className="home-section-intro">
          <SectionHeader title="Why collectors trust dalow" subtitle="The product stays calm, direct, and transaction-focused." />
          <p className="home-section-note">
            Trust is mostly structural: clear identity, visible signals, and less wasted motion.
          </p>
        </div>
        <div className="home-section-body">
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
          <div className="home-signal-grid">
            <HomeSignalCard
              eyebrow="Identity"
              title="Host, seller, and owner context stay attached."
              copy="The platform keeps people and inventory tied together instead of hiding trust cues."
            />
            <HomeSignalCard
              eyebrow="Pacing"
              title="Each surface reveals the next useful action."
              copy="You should be able to browse, join, bid, or message without feeling lost."
            />
            <HomeSignalCard
              eyebrow="Quality"
              title="Less chrome, more useful collector information."
              copy="The interface stays premium by staying disciplined."
            />
          </div>
        </div>
      </section>

      <section className="home-scroll-section home-final-section">
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
