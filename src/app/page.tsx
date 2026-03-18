import Image from "next/image";
import Link from "next/link";
import {
  EmptyStateCard,
  PageContainer,
  PrimaryButton,
  SecondaryButton,
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

function classNames(...parts: Array<string | null | undefined | false>) {
  return parts.filter(Boolean).join(" ");
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

function HomeActionColumn({
  eyebrow,
  title,
  copy,
  detail,
}: {
  eyebrow: string;
  title: string;
  copy: string;
  detail: string;
}) {
  return (
    <article className="landing-action-column">
      <span className="landing-section-kicker">{eyebrow}</span>
      <h3>{title}</h3>
      <p>{copy}</p>
      <strong>{detail}</strong>
    </article>
  );
}

function HomeStoryPoint({
  title,
  copy,
}: {
  title: string;
  copy: string;
}) {
  return (
    <li className="landing-story-point">
      <span className="landing-story-marker" aria-hidden="true" />
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
  const data = await getHomePageData();
  const heroStream = data.streams[0];
  const heroAuction = data.auctions[0];
  const heroTrade = data.trades[0];
  const heroStreamSecondary = data.streams[1] ?? heroStream;
  const heroTradeSecondary = data.trades[1] ?? heroTrade;

  return (
    <PageContainer className="landing-page">
      <div className="landing-desktop-layout">
        <section className="landing-section landing-hero">
          <div className="landing-hero-copy">
            <p className="landing-eyebrow">For collectors, by collectors</p>
            <h1>Live. Auctions. Trades.</h1>
            <p>
              One premium collectibles platform for real-time streams, live bidding, and structured collector deals.
            </p>
            <div className="landing-hero-actions">
              <PrimaryButton href="/listings">Explore marketplace</PrimaryButton>
              <SecondaryButton href="/live">Watch live</SecondaryButton>
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
            <SurfacePreview
              title={heroStreamSecondary.title}
              subtitle={`${heroStreamSecondary.host} · ${heroStreamSecondary.category}`}
              meta={`${heroStreamSecondary.watchers.toLocaleString()} watching · ${heroStreamSecondary.priceLabel}`}
              imageUrl={heroStreamSecondary.imageUrl}
              href={heroStreamSecondary.href}
              accent="Room"
              className="landing-showcase-card is-hero-room"
            />
          </div>
        </section>

        <section className="landing-section landing-actions-section">
          <div className="landing-section-head">
            <p className="landing-section-kicker">Core actions</p>
            <h2>Three ways collectors move inventory</h2>
          </div>
          <div className="landing-actions-strip">
            <HomeActionColumn
              eyebrow="Live"
              title="Run high-signal streams with active bidding."
              copy="Host sessions, surface watchers, and keep the room focused on inventory."
              detail="Real-time selling with momentum."
            />
            <HomeActionColumn
              eyebrow="Auctions"
              title="Create urgency and discover real market value."
              copy="Timed bidding and live inventory movement make price discovery feel immediate."
              detail="Auction rails that actually move."
            />
            <HomeActionColumn
              eyebrow="Trades"
              title="Negotiate collector-to-collector deals in a structured flow."
              copy="Value ranges, offers, and messaging stay attached to the item instead of disappearing into DMs."
              detail="Serious deals with real structure."
            />
          </div>
        </section>

        <section className="landing-section landing-story">
          <div className="landing-story-visual">
            <SurfacePreview
              title={heroAuction.title}
              subtitle={`${heroAuction.category} · ${heroAuction.seller}`}
              meta={`${heroAuction.currentBidLabel} · ${heroAuction.timeLeftLabel}`}
              imageUrl={heroAuction.imageUrl}
              href={heroAuction.href}
              accent="Auction momentum"
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
                title={heroTradeSecondary.title}
                subtitle={heroTradeSecondary.owner}
                meta={`${heroTradeSecondary.valueLabel} · ${heroTradeSecondary.offersCount} offers`}
                imageUrl={heroTradeSecondary.imageUrl}
                href={heroTradeSecondary.href}
                accent="Trade follow-through"
                className="landing-story-card is-story-secondary"
              />
            </div>
          </div>
          <div className="landing-story-copy">
            <p className="landing-section-kicker">Connected workflow</p>
            <h2>One connected collector workflow</h2>
            <p>
              Market discovery, live commerce, and negotiation all happen in one place.
            </p>
            <ul className="landing-story-points">
              <HomeStoryPoint
                title="Discover inventory fast"
                copy="Listings, cert context, and active rooms sit in one feed instead of separate product silos."
              />
              <HomeStoryPoint
                title="Turn momentum into bids"
                copy="A live stream can move attention directly into an auction without losing collector context."
              />
              <HomeStoryPoint
                title="Move serious deals into trades"
                copy="The same inventory graph can keep moving through offers and negotiation when bids are not the answer."
              />
            </ul>
          </div>
        </section>

        <section className="landing-section landing-trust">
          <div className="landing-section-head">
            <p className="landing-section-kicker">Why it works</p>
            <h2>Built around how the hobby actually works</h2>
            <p>
              dalow is designed around the signals collectors actually use when they decide to buy, bid, or trade.
            </p>
          </div>
          <div className="landing-trust-grid">
            <HomeTrustPoint
              title="Image-first inventory"
              copy="Listings stay visual, with the details layered in only where they help the decision."
            />
            <HomeTrustPoint
              title="Real-time selling and bidding"
              copy="Rooms, watchers, and active bids create momentum that feels native to the hobby."
            />
            <HomeTrustPoint
              title="Structured collector negotiation"
              copy="Trades keep value ranges, offers, and conversation tied to the item itself."
            />
            <HomeTrustPoint
              title="Shared identity across the platform"
              copy="Hosts, sellers, and collectors carry context with them instead of starting from zero every time."
            />
          </div>
        </section>

        <section className="landing-section landing-final">
          <p className="landing-section-kicker">Next step</p>
          <h2>Start listing, bidding, or trading.</h2>
          <p>Built for collectors who want more than static listings.</p>
          <div className="landing-final-actions">
            <PrimaryButton href="/listings">Open marketplace</PrimaryButton>
            <SecondaryButton href="/live">Watch live</SecondaryButton>
          </div>
        </section>
      </div>

      <div className="landing-mobile-layout">
        <section className="landing-mobile-section landing-mobile-hero">
          <p className="landing-eyebrow">For collectors, by collectors</p>
          <h1>Live. Auctions. Trades.</h1>
          <p className="landing-mobile-copy">
            A premium platform for real-time streams, timed bidding, and structured collector deals.
          </p>
          <div className="landing-mobile-actions">
            <PrimaryButton href="/listings">Explore marketplace</PrimaryButton>
            <SecondaryButton href="/live">Watch live</SecondaryButton>
          </div>
          <p className="landing-mobile-note">Browse active inventory. Join live rooms. Negotiate collector deals.</p>
        </section>

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

        <section className="landing-mobile-section landing-mobile-actions-section">
          <div className="landing-mobile-head">
            <p className="landing-section-kicker">Core actions</p>
            <h2>Three ways collectors move inventory</h2>
          </div>
          <div className="landing-mobile-action-rail">
            <HomeActionColumn
              eyebrow="Live"
              title="Run high-signal streams with active bidding."
              copy="Go live and keep the room focused on real inventory."
              detail="Real-time momentum."
            />
            <HomeActionColumn
              eyebrow="Auctions"
              title="Create urgency and discover real market value."
              copy="Timed bidding keeps price discovery immediate."
              detail="Auction movement."
            />
            <HomeActionColumn
              eyebrow="Trades"
              title="Negotiate collector deals in a structured flow."
              copy="Offers and messages stay tied to the item."
              detail="Collector-to-collector."
            />
          </div>
        </section>

        <section className="landing-mobile-section landing-mobile-story">
          <div className="landing-mobile-head">
            <p className="landing-section-kicker">Connected workflow</p>
            <h2>One connected collector workflow</h2>
          </div>
          <SurfacePreview
            title={heroAuction.title}
            subtitle={`${heroAuction.category} · ${heroAuction.seller}`}
            meta={`${heroAuction.currentBidLabel} · ${heroAuction.timeLeftLabel}`}
            imageUrl={heroAuction.imageUrl}
            href={heroAuction.href}
            accent="Flow"
            className="landing-mobile-story-card"
          />
          <ul className="landing-mobile-story-points">
            <HomeStoryPoint
              title="Discover inventory fast"
              copy="See live rooms, listings, and collector context in one flow."
            />
            <HomeStoryPoint
              title="Turn momentum into bids"
              copy="Live attention can move directly into active auctions."
            />
            <HomeStoryPoint
              title="Move serious deals into trades"
              copy="When bidding is not the answer, offers pick up where the room left off."
            />
          </ul>
        </section>

        <section className="landing-mobile-section landing-mobile-final">
          <p className="landing-section-kicker">Next step</p>
          <h2>Start listing, bidding, or trading.</h2>
          <p>Built for collectors who want more than static listings.</p>
          <div className="landing-mobile-actions">
            <PrimaryButton href="/listings">Explore marketplace</PrimaryButton>
            <SecondaryButton href="/live">Watch live</SecondaryButton>
          </div>
        </section>
      </div>

      {data.streams.length === 0 && data.auctions.length === 0 && data.trades.length === 0 ? (
        <EmptyStateCard
          title="No previews available yet."
          description="Once inventory is live, dalow will surface stream, auction, and trade previews here."
        />
      ) : null}
    </PageContainer>
  );
}
