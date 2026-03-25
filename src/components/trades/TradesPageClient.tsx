"use client";

import { useEffect, useState } from "react";
import { CheckersLoader } from "@/components/CheckersLoader";
import { ListingCard } from "@/components/market/ListingCard";
import {
  EmptyStateCard,
  PageContainer,
  PageHeader,
  PrimaryButton,
} from "@/components/product/ProductUI";
import { useMobileUi } from "@/hooks/useMobileUi";
import { useSavedListings } from "@/hooks/useSavedListings";

import { fetchClientApi, normalizeClientError } from "@/lib/client-api";
import type { TradePostListItem } from "@/lib/trade-client";

type TradesPageClientProps = {
  initialIsMobile?: boolean;
};

export function TradesPageClient({ initialIsMobile }: TradesPageClientProps) {
  const isMobileUi = useMobileUi(initialIsMobile);
  const { tradePostIds, toggleTradeSave } = useSavedListings();
  const [query, setQuery] = useState("");
  const [posts, setPosts] = useState<TradePostListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams();
        params.set("limit", "80");
        if (query.trim()) params.set("q", query.trim());
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
  }, [query]);

  const searchBar = (
    <div className="trades-search-bar">
      <svg className="trades-search-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.6" />
        <path d="M13 13l3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <input
        className="trades-search-input"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by title, card, grade, player…"
        autoComplete="off"
        spellCheck={false}
      />
      {query ? (
        <button
          type="button"
          className="trades-search-clear"
          onClick={() => setQuery("")}
          aria-label="Clear search"
        >
          <svg viewBox="0 0 16 16" fill="none">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      ) : null}
    </div>
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
            {searchBar}
          </section>

          {error ? <EmptyStateCard title="Trade board unavailable" description={error} /> : null}
          {loading ? <CheckersLoader title="Loading trades…" compact /> : null}

          {!loading ? (
            <section className="mobile-feed-section trades-mobile-feed-section">
              <div className="mobile-feed-section-head">
                <h2>Trade feed</h2>
                <span>{posts.length}</span>
              </div>
              {posts.length === 0 ? (
                <EmptyStateCard title="No open trade posts right now." description="Try a different search or check back soon." />
              ) : (
                <div className={`trade-board-grid ${posts.length < 3 ? "is-sparse" : ""}`}>
                  {posts.map((post) => (
                    <ListingCard
                      key={post.id}
                      kind="trade"
                      trade={post}
                      saved={tradePostIds.has(post.id)}
                      onToggleSave={toggleTradeSave}
                    />
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
        {searchBar}

        {error ? <EmptyStateCard title="Trade board unavailable" description={error} /> : null}
        {loading ? <CheckersLoader title="Loading trades…" compact /> : null}

        {!loading && !error ? (
          <section className="trades-feed">
            <div className="trades-feed-header">
              <span className="trades-feed-count">{posts.length} open</span>
            </div>

            {posts.length === 0 ? (
              <EmptyStateCard
                title="No trade posts match."
                description="Try a different search term."
              />
            ) : (
              <div className={`trade-board-grid ${posts.length < 3 ? "is-sparse" : ""}`}>
                {posts.map((post) => (
                  <ListingCard
                    key={post.id}
                    kind="trade"
                    trade={post}
                    saved={tradePostIds.has(post.id)}
                    onToggleSave={toggleTradeSave}
                  />
                ))}
              </div>
            )}
          </section>
        ) : null}
      </section>
    </PageContainer>
  );
}
