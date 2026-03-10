"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { signIn, useSession } from "next-auth/react";
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
  if (status === "OPEN") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "MATCHED") return "border-blue-200 bg-blue-50 text-blue-700";
  if (status === "PAUSED") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-white text-slate-600";
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
        const response = await fetch(`/api/trades?${params.toString()}`, { cache: "no-store" });
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
          setError(err instanceof Error ? err.message : "Unable to load trades.");
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
    <div className="ios-screen">
      <section className="ios-hero space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <h1 className="ios-title">Trades</h1>
          </div>
          <Link
            href="/trades/new"
            className="rounded-full bg-slate-900 px-5 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-white"
          >
            New trade
          </Link>
        </div>

        <div className="ios-panel p-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search trades"
              className="ios-input"
            />
            <div className="ios-chip-row lg:justify-end">
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
          </div>
        </div>

        <div className="ios-stat-grid">
          <div className="ios-stat-card">
            <p className="ios-stat-label">Visible posts</p>
            <p className="ios-stat-value">{posts.length}</p>
          </div>
          <div className="ios-stat-card">
            <p className="ios-stat-label">Open now</p>
            <p className="ios-stat-value">{openCount}</p>
          </div>
        </div>
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
        <div className="ios-empty">
          Loading trades...
        </div>
      ) : null}

      {!loading && posts.length === 0 ? (
        <div className="ios-empty">
          No posts yet.
        </div>
      ) : null}

      <section className="grid gap-3 lg:grid-cols-2">
        {posts.map((post) => {
          const image = post.images[0]?.url || "";
          const canRenderImage = isValidImageUrl(image);
          const tags = toTagArray(post.tags).slice(0, 3);
          return (
            <Link
              key={post.id}
              href={`/trades/${encodeURIComponent(post.id)}`}
              className="ios-panel p-3 transition hover:-translate-y-0.5"
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
                    <>
                      <Image
                        src="/dalow-logo.svg"
                        alt="dalow logo"
                        fill
                        sizes="120px"
                        className="object-contain p-5"
                      />
                      <Image
                        src="/charts/market-line.svg"
                        alt=""
                        aria-hidden="true"
                        fill
                        sizes="120px"
                        className="object-cover opacity-25 mix-blend-screen"
                      />
                    </>
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${statusChip(post.status)}`}>
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
