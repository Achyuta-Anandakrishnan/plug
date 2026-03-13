"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { CheckersLoader } from "@/components/CheckersLoader";
import { fetchClientApi, normalizeClientError } from "@/lib/client-api";
import { resolveDisplayMediaUrl } from "@/lib/media-placeholders";
import {
  formatTradeDate,
  isValidImageUrl,
  toTagArray,
  tradeValueLabel,
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

function statusChip(status: TradePostListItem["status"]) {
  if (status === "OPEN") return "trade-status-chip is-open";
  if (status === "MATCHED") return "trade-status-chip is-matched";
  if (status === "PAUSED") return "trade-status-chip is-paused";
  if (status === "CLOSED") return "trade-status-chip is-closed";
  return "trade-status-chip";
}

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

  const openCount = useMemo(
    () => posts.filter((entry) => entry.status === "OPEN").length,
    [posts],
  );

  return (
    <div className="ios-screen product-shell trades-page">
      <section className="product-page-header">
        <h1 className="product-page-title">Trades</h1>
        <Link
          href="/trades/new"
          className="product-page-primary"
        >
          New trade
        </Link>
      </section>

      <section className="product-toolbar trades-toolbar">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search trades"
          className="ios-input"
        />
        <div className="ios-chip-row">
          {scopes.map((entry) => (
            <button
              key={entry.key}
              type="button"
              onClick={() => setScope(entry.key)}
              className={`ios-chip ${scope === entry.key ? "ios-chip-active" : ""}`}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </section>

      <section className="product-stats">
        <article className="product-stat-card">
          <p>Visible posts</p>
          <h3>{posts.length}</h3>
        </article>
        <article className="product-stat-card">
          <p>Open now</p>
          <h3>{openCount}</h3>
        </article>
      </section>

      {!session?.user?.id && scope === "MINE" ? (
        <div className="ios-panel p-5">
          <p className="text-sm text-slate-600">Sign in to view your trade posts.</p>
          <button
            type="button"
            onClick={() => signIn()}
            className="mt-3 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Sign in
          </button>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      ) : null}

      {loading ? (
        <CheckersLoader title="Loading trades..." compact className="ios-empty" />
      ) : null}

      {!loading && posts.length === 0 ? (
        <div className="ios-empty">No trade posts found.</div>
      ) : null}

      <section className="trade-board-grid">
        {posts.map((post) => {
          const image = post.images[0]?.url || "";
          const canRenderImage = isValidImageUrl(image);
          const tags = toTagArray(post.tags).slice(0, 3);
          return (
            <Link
              key={post.id}
              href={`/trades/${encodeURIComponent(post.id)}`}
              className="ios-panel trade-board-card"
            >
              <div className="grid gap-3 sm:grid-cols-[120px_minmax(0,1fr)]">
                <div className="relative h-28 overflow-hidden rounded-2xl border border-white/60 bg-white/60">
                  {canRenderImage ? (
                    <img
                      src={image}
                      alt={post.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Image
                      src={resolveDisplayMediaUrl(null)}
                      alt="Card placeholder"
                      fill
                      sizes="120px"
                      className="object-cover"
                    />
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={statusChip(post.status)}>
                      {post.status}
                    </span>
                    <span className="text-xs text-slate-500">{formatTradeDate(post.createdAt)}</span>
                  </div>
                  <h2 className="mt-2 truncate text-lg font-semibold text-slate-900">{post.title}</h2>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-600">{post.lookingFor}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span>{tradeValueLabel(post.valueMin, post.valueMax)}</span>
                    <span>•</span>
                    <span>{post._count.offers} offers</span>
                    <span>•</span>
                    <span>{post.owner.displayName ?? post.owner.username ?? "Member"}</span>
                  </div>
                  {tags.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full border border-slate-200 bg-white/90 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
