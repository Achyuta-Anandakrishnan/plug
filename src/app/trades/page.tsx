"use client";

import { useEffect, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { CheckersLoader } from "@/components/CheckersLoader";
import { ListingCard } from "@/components/market/ListingCard";
import {
  DiscoveryBar,
  EmptyStateCard,
  FilterChip,
  PageContainer,
  PrimaryButton,
} from "@/components/product/ProductUI";
import { fetchClientApi, normalizeClientError } from "@/lib/client-api";
import {
  type TradePostListItem,
} from "@/lib/trade-client";

type TradeScope = "OPEN" | "PAUSED" | "MATCHED" | "CLOSED" | "ALL" | "MINE";

const scopes: Array<{ key: TradeScope; label: string }> = [
  { key: "OPEN", label: "Open" },
  { key: "PAUSED", label: "Paused" },
  { key: "MATCHED", label: "Matched" },
  { key: "CLOSED", label: "Closed" },
  { key: "ALL", label: "All" },
  { key: "MINE", label: "Mine" },
];

export default function TradesPage() {
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
    return () => {
      cancelled = true;
    };
  }, [query, scope, session?.user?.id]);

  return (
    <PageContainer className="trades-page app-page--trades">
      <section className="app-section">
        <DiscoveryBar className="app-control-bar trades-toolbar">
          <div className="app-control-title">Trades</div>
          <div className="app-search">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14m0-2a9 9 0 1 0 5.65 16l4.68 4.67 1.42-1.41-4.67-4.68A9 9 0 0 0 11 2" fill="currentColor" />
            </svg>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search trade posts"
            />
          </div>
          <div className="app-chip-row">
            {scopes.map((entry) => (
              <FilterChip
                key={entry.key}
                label={entry.label}
                active={scope === entry.key}
                onClick={() => setScope(entry.key)}
              />
            ))}
          </div>
          <div className="app-toolbar-spacer" aria-hidden="true" />
          <PrimaryButton href="/trades/new">New trade</PrimaryButton>
        </DiscoveryBar>

        {!session?.user?.id && scope === "MINE" ? (
          <EmptyStateCard
            title="Sign in to view your trade posts."
            description="Your own trade activity stays separate from the public board."
            action={<PrimaryButton onClick={() => signIn()}>Sign in</PrimaryButton>}
          />
        ) : null}

        {error ? <EmptyStateCard title="Trade board unavailable" description={error} /> : null}
        {loading ? <CheckersLoader title="Loading trades..." compact className="ios-empty" /> : null}

        <section className="app-section">
          {!loading && posts.length === 0 ? (
            <EmptyStateCard title="No active trade posts right now." description="Try another status filter or check back when collectors publish new wants." />
          ) : null}

          <div className="trade-board-grid">
            {posts.map((post) => (
              <ListingCard key={post.id} kind="trade" trade={post} />
            ))}
          </div>
        </section>
      </section>
    </PageContainer>
  );
}
