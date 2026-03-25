"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { CheckersLoader } from "@/components/CheckersLoader";
import {
  DiscoveryBar,
  EmptyStateCard,
  FilterChip,
  PageContainer,
  PageHeader,
  PrimaryButton,
  SearchIcon,
} from "@/components/product/ProductUI";
import { useMobileUi } from "@/hooks/useMobileUi";

import { fetchClientApi, normalizeClientError } from "@/lib/client-api";
import { tradeValueLabel, type TradePostListItem } from "@/lib/trade-client";
import { resolveDisplayMediaUrl } from "@/lib/media-placeholders";

type TradeScope = "OPEN" | "PAUSED" | "MATCHED" | "CLOSED" | "ALL" | "MINE";

const scopes: Array<{ key: TradeScope; label: string }> = [
  { key: "OPEN", label: "Open" },
  { key: "PAUSED", label: "Paused" },
  { key: "MATCHED", label: "Matched" },
  { key: "CLOSED", label: "Closed" },
  { key: "ALL", label: "All" },
  { key: "MINE", label: "Mine" },
];

function statusChipClass(status: string) {
  switch (status) {
    case "OPEN": return "trade-row-status is-open";
    case "MATCHED": return "trade-row-status is-matched";
    case "PAUSED": return "trade-row-status is-paused";
    default: return "trade-row-status is-closed";
  }
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d`;
  return `${Math.floor(days / 30)}mo`;
}

function compactMeta(trade: TradePostListItem) {
  const parts: string[] = [];
  if (trade.category) parts.push(trade.category);
  const grade = [trade.gradeCompany, trade.gradeLabel].filter(Boolean).join(" ");
  if (grade) parts.push(grade);
  if (trade.condition) parts.push(trade.condition);
  return parts.slice(0, 3).join(" · ") || "Trade post";
}

function TradeRow({ trade }: { trade: TradePostListItem }) {
  const fallback = "/placeholders/pokemon-generic.svg";
  const imgUrl = resolveDisplayMediaUrl(trade.images[0]?.url ?? null, fallback);
  const [imgError, setImgError] = useState(false);

  return (
    <Link href={`/trades/${trade.id}`} className="trade-row">
      <div className="trade-row-thumb">
        <Image
          src={imgError ? fallback : imgUrl}
          alt={trade.title}
          fill
          sizes="56px"
          className="trade-row-img"
          unoptimized
          onError={() => setImgError(true)}
        />
      </div>

      <div className="trade-row-body">
        <p className="trade-row-title">{trade.title}</p>
        <p className="trade-row-meta">{compactMeta(trade)}</p>
      </div>

      <div className="trade-row-aside">
        <span className={statusChipClass(trade.status)}>{trade.status}</span>
        <span className="trade-row-value">{tradeValueLabel(trade.valueMin, trade.valueMax)}</span>
      </div>

      <div className="trade-row-stats">
        <span className="trade-row-offers">
          {trade._count.offers} {trade._count.offers === 1 ? "offer" : "offers"}
        </span>
        <span className="trade-row-time">{timeAgo(trade.createdAt)}</span>
      </div>
    </Link>
  );
}

type TradesPageClientProps = {
  initialIsMobile?: boolean;
};

export function TradesPageClient({ initialIsMobile }: TradesPageClientProps) {
  const isMobileUi = useMobileUi(initialIsMobile);
  const { data: session } = useSession();
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<TradeScope>("OPEN");
  const [posts, setPosts] = useState<TradePostListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");


  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!session?.user?.id && scope === "MINE") {
        setPosts([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams();
        params.set("limit", "80");
        if (query.trim()) params.set("q", query.trim());
        if (scope === "MINE") params.set("mine", "1");
        else if (scope !== "ALL") params.set("status", scope);
        const response = await fetchClientApi(`/api/trades?${params.toString()}`, { cache: "no-store" });
        const payload = (await response.json()) as TradePostListItem[] & { error?: string };
        if (!response.ok) {
          throw new Error(payload.error || "Unable to load trades.");
        }
        if (!cancelled) {
          setPosts(payload);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(normalizeClientError(err, "Unable to load trades."));
          setLoading(false);
        }
      }
    };

    void run();
    return () => { cancelled = true; };
  }, [query, scope, session?.user?.id]);

  const filterBar = (
    <DiscoveryBar className="app-control-bar listing-system-toolbar trades-toolbar">
      <div className="listing-system-toolbar-main trades-toolbar-main">
        <div className="app-search">
          <SearchIcon />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title, card, grade…"
          />
        </div>
        <div className="app-chip-row">
          {scopes.map((s) => (
            <FilterChip
              key={s.key}
              label={s.label}
              active={scope === s.key}
              onClick={() => setScope(s.key)}
            />
          ))}
        </div>
      </div>
    </DiscoveryBar>
  );

  if (isMobileUi) {
    return (
      <PageContainer className="trades-page listing-system-page app-page--trades trades-mobile-page">
        <section className="app-section trades-mobile-screen">
          <section className="trades-mobile-subheader">
            <div className="mobile-page-toolbar-top">
              <div className="app-control-title">Trades</div>
              <PrimaryButton href="/trades/new" className="trades-mobile-create">New trade</PrimaryButton>
            </div>
            <div className="app-search">
              <SearchIcon />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search trade posts"
              />
            </div>
            <div className="mobile-page-toolbar-scroll trades-mobile-chiprail">
              {scopes.map((s) => (
                <FilterChip
                  key={s.key}
                  label={s.label}
                  active={scope === s.key}
                  onClick={() => setScope(s.key)}
                />
              ))}
            </div>
          </section>

          {!session?.user?.id && scope === "MINE" ? (
            <EmptyStateCard
              title="Sign in to view your trade posts."
              description="Your own trade activity stays separate from the public board."
              action={<PrimaryButton onClick={() => signIn()}>Sign in</PrimaryButton>}
            />
          ) : null}

          {error ? <EmptyStateCard title="Trade board unavailable" description={error} /> : null}
          {loading ? <CheckersLoader title="Loading trades…" compact /> : null}

          {!loading ? (
            <section className="mobile-feed-section trades-mobile-feed-section">
              <div className="mobile-feed-section-head">
                <h2>Trade feed</h2>
                <span>{posts.length}</span>
              </div>
              {posts.length === 0 ? (
                <EmptyStateCard title="No active trade posts right now." description="Try another status filter or check back soon." />
              ) : (
                <div className="trades-compact-list">
                  {posts.map((post) => (
                    <TradeRow key={post.id} trade={post} />
                  ))}
                </div>
              )}
            </section>
          ) : null}
        </section>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="trades-page listing-system-page app-page--trades">
      <PageHeader
        title="Trades"
        subtitle="Post what you have. Find what you want."
        actions={<PrimaryButton href="/trades/new">New trade</PrimaryButton>}
      />

      <section className="app-section">
        {filterBar}

        {!session?.user?.id && scope === "MINE" ? (
          <EmptyStateCard
            title="Sign in to view your trade posts."
            description="Your own trade activity stays separate from the public board."
            action={<PrimaryButton onClick={() => signIn()}>Sign in</PrimaryButton>}
          />
        ) : null}

        {error ? <EmptyStateCard title="Trade board unavailable" description={error} /> : null}
        {loading ? <CheckersLoader title="Loading trades…" compact /> : null}

        {!loading && !error ? (
          <section className="trades-feed">
            <div className="trades-feed-header">
              <span className="trades-feed-count">{posts.length} {scope === "ALL" ? "total" : scope.toLowerCase()}</span>
            </div>

            {posts.length === 0 ? (
              <EmptyStateCard
                title="No trade posts match."
                description="Try a different status filter or search term."
              />
            ) : (
              <div className="trades-compact-list">
                {posts.map((post) => (
                  <TradeRow key={post.id} trade={post} />
                ))}
              </div>
            )}
          </section>
        ) : null}
      </section>
    </PageContainer>
  );
}
