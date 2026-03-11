import { FinalCTA } from "@/components/home/FinalCTA";
import { LandingHero } from "@/components/home/LandingHero";
import { ProductPreviewShowcase } from "@/components/home/ProductPreviewShowcase";
import { TrustSection } from "@/components/home/TrustSection";
import type { HomeAuctionPreview, HomeLiveStreamPreview, HomeTradePreview } from "@/components/home/types";
import { ValuePillars } from "@/components/home/ValuePillars";
import { WhyDalow } from "@/components/home/WhyDalow";
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
  return items.slice(0, 8).map((stream) => {
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
    .slice(0, 8)
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
  return items.slice(0, 8).map((trade) => ({
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
  return mockAuctions.slice(0, 8).map((auction) => ({
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
    fetchJson<AuctionApiItem[]>("/api/auctions?status=LIVE&view=streams&limit=8"),
    fetchJson<AuctionApiItem[]>("/api/auctions?status=LIVE&view=listings&limit=12"),
    fetchJson<TradeApiItem[]>("/api/trades?limit=8"),
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

export default async function Home() {
  const data = await getHomePageData();
  const heroStream = data.streams[0];
  const heroAuction = data.auctions[0];
  const heroTrade = data.trades[0];

  return (
    <div className="home-v3-page">
      <LandingHero stream={heroStream} auction={heroAuction} trade={heroTrade} />
      <ValuePillars />
      <WhyDalow />
      <ProductPreviewShowcase streams={data.streams} auctions={data.auctions} trades={data.trades} />
      <TrustSection />
      <FinalCTA />
    </div>
  );
}
