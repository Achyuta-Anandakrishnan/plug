"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { AuctionCard } from "@/components/AuctionCard";
import { CheckersLoader } from "@/components/CheckersLoader";
import { useAuctions } from "@/hooks/useAuctions";
import { useCategories } from "@/hooks/useCategories";
import {
  getGradeLabel,
  getPrimaryImageUrl,
  getTimeLeftSeconds,
} from "@/lib/auctions";
import { resolveDisplayMediaUrl } from "@/lib/media-placeholders";

type MarketMode = "all" | "buy-now" | "auctions" | "streams";

const QUICK_CATEGORIES = [
  { label: "All", slug: "" },
  { label: "Pokemon", slug: "pokemon" },
  { label: "Sports", slug: "sports" },
  { label: "Funko", slug: "funko" },
] as const;

const MODE_OPTIONS: Array<{ mode: MarketMode; label: string }> = [
  { mode: "all", label: "All" },
  { mode: "buy-now", label: "Buy now" },
  { mode: "auctions", label: "Auctions" },
  { mode: "streams", label: "Streams" },
];

function parseMode(value: string | null): MarketMode {
  if (value === "buy-now" || value === "auctions" || value === "streams") {
    return value;
  }
  return "all";
}

function getCategoryKey(slug: string, name: string) {
  const combined = `${slug} ${name}`.toLowerCase();
  if (combined.includes("pokemon")) return "pokemon";
  if (combined.includes("sport")) return "sports";
  if (combined.includes("funko")) return "funko";
  return slug.trim().toLowerCase();
}

function formatSchedule(startTime: string | null) {
  if (!startTime) return "Scheduled";
  const date = new Date(startTime);
  if (Number.isNaN(date.getTime())) return "Scheduled";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function MarketHub() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const modeFromUrl = parseMode(searchParams.get("mode"));
  const [query, setQuery] = useState("");
  const [categorySlug, setCategorySlug] = useState("");
  const [buyLoadingId, setBuyLoadingId] = useState<string | null>(null);
  const [buyMessage, setBuyMessage] = useState("");
  const [streamExpanded, setStreamExpanded] = useState(false);
  const [endingStreamId, setEndingStreamId] = useState<string | null>(null);
  const [streamActionLoading, setStreamActionLoading] = useState<"start" | "schedule" | null>(null);
  const canManageStreams = session?.user?.role === "SELLER" || session?.user?.role === "ADMIN";

  const { data: categories } = useCategories();
  const baseOptions = {
    category: categorySlug || undefined,
    query: query.trim() || undefined,
  } as const;

  const {
    data: liveListings,
    loading: listingsLoading,
    error: listingsError,
    refresh: refreshListings,
  } = useAuctions({
    ...baseOptions,
    status: "LIVE",
  });

  const {
    data: liveStreams,
    loading: liveStreamsLoading,
    refresh: refreshLiveStreams,
  } = useAuctions({
    ...baseOptions,
    status: "LIVE",
    view: "streams",
  });

  const {
    data: scheduledStreams,
    loading: scheduledStreamsLoading,
    refresh: refreshScheduledStreams,
  } = useAuctions({
    ...baseOptions,
    status: "SCHEDULED",
    view: "streams",
  });

  const filteredListings = useMemo(() => {
    if (modeFromUrl === "buy-now") {
      return liveListings.filter((entry) => entry.listingType !== "AUCTION");
    }
    if (modeFromUrl === "auctions") {
      return liveListings.filter((entry) => entry.listingType !== "BUY_NOW");
    }
    if (modeFromUrl === "streams") {
      return [];
    }
    return liveListings;
  }, [liveListings, modeFromUrl]);

  const extraCategories = useMemo(() => {
    const seen = new Set<string>(QUICK_CATEGORIES.map((entry) => entry.slug).filter(Boolean));
    const unique = [];
    for (const category of categories) {
      const key = getCategoryKey(category.slug, category.name);
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(category);
      if (unique.length >= 8) break;
    }
    return unique;
  }, [categories]);

  const railItems = useMemo(() => {
    const now = Date.now();
    const scheduledFuture = scheduledStreams
      .filter((entry) => entry.startTime && new Date(entry.startTime).getTime() > now)
      .sort((a, b) => {
        const aTime = a.startTime ? new Date(a.startTime).getTime() : Number.MAX_SAFE_INTEGER;
        const bTime = b.startTime ? new Date(b.startTime).getTime() : Number.MAX_SAFE_INTEGER;
        return aTime - bTime;
      });

    const ids = new Set<string>();
    const merged = [...liveStreams, ...scheduledFuture].filter((entry) => {
      if (ids.has(entry.id)) return false;
      ids.add(entry.id);
      return true;
    });

    return merged;
  }, [liveStreams, scheduledStreams]);

  const setMode = (mode: MarketMode) => {
    const next = new URLSearchParams(searchParams.toString());
    if (mode === "all") {
      next.delete("mode");
    } else {
      next.set("mode", mode);
    }
    const nextQuery = next.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  };

  const startBuyNow = async (auctionId: string) => {
    if (!session?.user?.id) {
      await signIn();
      return;
    }

    setBuyLoadingId(auctionId);
    setBuyMessage("");
    try {
      const response = await fetch(`/api/auctions/${auctionId}/buy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const payload = (await response.json()) as { error?: string; checkoutUrl?: string | null };
      if (!response.ok) {
        throw new Error(payload.error || "Unable to start checkout.");
      }
      if (payload.checkoutUrl && /^https?:\/\/[^\s]+$/i.test(payload.checkoutUrl)) {
        window.location.assign(payload.checkoutUrl);
        return;
      }
      setBuyMessage("Checkout initialized.");
    } catch (buyError) {
      setBuyMessage(buyError instanceof Error ? buyError.message : "Unable to start checkout.");
    } finally {
      setBuyLoadingId(null);
    }
  };

  const endStream = async (auctionId: string) => {
    if (!session?.user?.id) {
      await signIn();
      return;
    }

    setEndingStreamId(auctionId);
    try {
      const response = await fetch("/api/streams/session", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auctionId, status: "ENDED" }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Unable to end stream.");
      }
      await Promise.all([refreshLiveStreams(), refreshScheduledStreams(), refreshListings()]);
    } catch (streamError) {
      setBuyMessage(streamError instanceof Error ? streamError.message : "Unable to end stream.");
    } finally {
      setEndingStreamId(null);
    }
  };

  const startOrScheduleStream = async (mode: "start" | "schedule") => {
    if (!session?.user?.id) {
      await signIn();
      return;
    }

    let scheduleAt: string | undefined;
    if (mode === "schedule") {
      const raw = window.prompt("Schedule stream (YYYY-MM-DD HH:MM, local time)");
      if (!raw) return;
      const normalized = raw.trim().replace(" ", "T");
      const parsed = new Date(normalized);
      if (Number.isNaN(parsed.getTime()) || parsed <= new Date()) {
        setBuyMessage("Use a valid future date and time.");
        return;
      }
      scheduleAt = parsed.toISOString();
    }

    setStreamActionLoading(mode);
    try {
      const response = await fetch("/api/streams/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduleAt }),
      });
      const payload = (await response.json()) as { error?: string; auctionId?: string };
      if (!response.ok || !payload.auctionId) {
        throw new Error(payload.error || "Unable to create stream.");
      }

      await Promise.all([refreshLiveStreams(), refreshScheduledStreams(), refreshListings()]);
      if (mode === "schedule") {
        setBuyMessage("Stream scheduled.");
      } else {
        router.push(`/streams/${payload.auctionId}`);
      }
    } catch (streamError) {
      setBuyMessage(streamError instanceof Error ? streamError.message : "Unable to create stream.");
    } finally {
      setStreamActionLoading(null);
    }
  };

  const streamLoading = liveStreamsLoading || scheduledStreamsLoading;
  const listingsLoadingState = listingsLoading && modeFromUrl !== "streams";

  return (
    <div className="ios-screen market-shell space-y-4">
      <section className="ios-hero market-hero space-y-4">
        <div className="space-y-2">
          <h1 className="ios-title">Marketplace</h1>
        </div>

        <div className="ios-panel market-controls p-3 sm:p-4">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search"
            className="ios-input"
          />

          <div className="ios-chip-row mt-3">
            {MODE_OPTIONS.map((entry) => (
              <button
                key={entry.mode}
                type="button"
                onClick={() => setMode(entry.mode)}
                className={`ios-chip ${modeFromUrl === entry.mode ? "ios-chip-active" : ""}`}
              >
                {entry.label}
              </button>
            ))}
          </div>

          <div className="ios-chip-row mt-2">
            {QUICK_CATEGORIES.map((entry) => (
              <button
                key={entry.label}
                type="button"
                onClick={() => setCategorySlug(entry.slug)}
                className={`ios-chip ${categorySlug === entry.slug ? "ios-chip-active" : ""}`}
              >
                {entry.label}
              </button>
            ))}
            {extraCategories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => setCategorySlug(category.slug)}
                className={`ios-chip ${categorySlug === category.slug ? "ios-chip-active" : ""}`}
              >
                {category.name}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="ios-panel market-stream-rail p-3 sm:p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="ios-section-title">Streams</h2>
          <div className="flex items-center gap-2">
            {canManageStreams ? (
              <>
                <button
                  type="button"
                  onClick={() => void startOrScheduleStream("start")}
                  disabled={streamActionLoading !== null}
                  className="rounded-full border border-slate-200 bg-slate-900 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white disabled:opacity-60"
                >
                  {streamActionLoading === "start" ? "Starting..." : "Start"}
                </button>
                <button
                  type="button"
                  onClick={() => void startOrScheduleStream("schedule")}
                  disabled={streamActionLoading !== null}
                  className="rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-700 disabled:opacity-60"
                >
                  {streamActionLoading === "schedule" ? "Saving..." : "Schedule"}
                </button>
              </>
            ) : null}
            <button
              type="button"
              onClick={() => setStreamExpanded((prev) => !prev)}
              className="rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-700"
            >
              {streamExpanded ? "Collapse" : "Expand"}
            </button>
          </div>
        </div>

        {streamLoading ? (
          <div className="mt-3">
            <CheckersLoader title="Loading streams..." compact className="ios-empty" />
          </div>
        ) : railItems.length === 0 ? (
          <div className="ios-empty mt-3">No live or scheduled streams.</div>
        ) : (
          <div className="market-stream-scroller mt-3">
            {railItems.map((stream) => {
              const streamImage = resolveDisplayMediaUrl(getPrimaryImageUrl(stream));
              const isLive = stream.streamSessions?.[0]?.status === "LIVE";
              const isHost = Boolean(session?.user?.id && stream.seller?.user?.id === session.user.id);

              return (
                <div key={stream.id} className="market-stream-card-wrap">
                  <Link href={`/streams/${stream.id}`} className="market-stream-card" aria-label={stream.title}>
                    <div className="market-stream-card-media">
                      <Image
                        src={streamImage}
                        alt={stream.title}
                        fill
                        sizes="(max-width: 768px) 150px, 180px"
                        className="object-cover"
                      />
                    </div>
                    <div className="market-stream-card-body">
                      <span className={`market-stream-status ${isLive ? "is-live" : "is-scheduled"}`}>
                        {isLive ? "Live" : "Scheduled"}
                      </span>
                      <p className="market-stream-title">{stream.title}</p>
                      <p className="market-stream-meta">
                        {isLive ? `${stream.watchersCount} watching` : formatSchedule(stream.startTime)}
                      </p>
                    </div>
                  </Link>

                  {isLive && isHost ? (
                    <button
                      type="button"
                      onClick={() => void endStream(stream.id)}
                      disabled={endingStreamId === stream.id}
                      className="market-stream-end"
                    >
                      {endingStreamId === stream.id ? "Ending..." : "End"}
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}

        {streamExpanded && railItems.length > 0 ? (
          <div className="mt-3 grid grid-cols-2 gap-3 min-[560px]:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {railItems.map((entry) => (
              <AuctionCard
                key={`expanded-${entry.id}`}
                id={entry.id}
                title={entry.title}
                sellerName={entry.seller?.user?.displayName ?? "Seller"}
                category={entry.category?.name ?? undefined}
                currentBid={entry.currentBid}
                timeLeft={getTimeLeftSeconds(entry)}
                watchers={entry.watchersCount}
                badge={entry.streamSessions?.[0]?.status === "LIVE" ? "Live" : "Scheduled"}
                imageUrl={getPrimaryImageUrl(entry)}
                listingType={entry.listingType}
                buyNowPrice={entry.buyNowPrice}
                currency={entry.currency?.toUpperCase()}
                gradeLabel={getGradeLabel(entry.item?.attributes) ?? undefined}
              />
            ))}
          </div>
        ) : null}
      </section>

      {listingsError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {listingsError}
        </div>
      ) : null}

      {buyMessage ? (
        <div className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-700">
          {buyMessage}
        </div>
      ) : null}

      {modeFromUrl === "streams" ? null : listingsLoadingState ? (
        <div className="market-loading-wrap">
          <CheckersLoader title="Loading market..." className="ios-empty" />
        </div>
      ) : filteredListings.length === 0 ? (
        <div className="ios-empty">No listings.</div>
      ) : (
        <section className="space-y-3">
          <h2 className="ios-section-title">Cards</h2>
          <div className="grid grid-cols-2 gap-3 min-[560px]:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {filteredListings.map((entry) => (
              <div key={entry.id} className="space-y-2">
                <AuctionCard
                  id={entry.id}
                  title={entry.title}
                  sellerName={entry.seller?.user?.displayName ?? "Seller"}
                  category={entry.category?.name ?? undefined}
                  currentBid={entry.currentBid}
                  timeLeft={getTimeLeftSeconds(entry)}
                  watchers={entry.watchersCount}
                  badge={entry.seller?.status === "APPROVED" ? "Verified" : undefined}
                  imageUrl={getPrimaryImageUrl(entry)}
                  listingType={entry.listingType}
                  buyNowPrice={entry.buyNowPrice}
                  currency={entry.currency?.toUpperCase()}
                  gradeLabel={getGradeLabel(entry.item?.attributes) ?? undefined}
                />
                {entry.listingType !== "AUCTION" && entry.buyNowPrice ? (
                  <button
                    type="button"
                    onClick={() => void startBuyNow(entry.id)}
                    disabled={buyLoadingId === entry.id}
                    className="w-full rounded-full border border-slate-200 bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white disabled:opacity-60"
                  >
                    {buyLoadingId === entry.id ? "Opening..." : "Buy"}
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
