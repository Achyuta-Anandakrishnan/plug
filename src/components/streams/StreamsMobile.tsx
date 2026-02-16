"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useAuctions } from "@/hooks/useAuctions";
import { useCategories } from "@/hooks/useCategories";
import { getPrimaryImageUrl, getTimeLeftSeconds } from "@/lib/auctions";
import { formatCurrency, formatSeconds } from "@/lib/format";

export function StreamsMobile() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [endingSoon, setEndingSoon] = useState(false);
  const { data: auctions, loading, error } = useAuctions({ status: "LIVE" });
  const { data: categories } = useCategories();

  const filteredStreams = useMemo(() => {
    let list = [...auctions];

    if (activeCategory !== "All") {
      list = list.filter(
        (stream) => stream.category?.name === activeCategory,
      );
    }

    if (endingSoon) {
      list.sort((a, b) => getTimeLeftSeconds(a) - getTimeLeftSeconds(b));
    }

    return list;
  }, [activeCategory, auctions, endingSoon]);

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">
            Live now
          </p>
          <h1 className="font-display text-[32px] text-slate-900">Streams</h1>
        </div>
        <div className="flex gap-2">
          <Link
            href="/streams/schedule"
            className="flex-1 rounded-full border border-slate-200 px-4 py-2 text-center text-xs font-semibold text-slate-600"
          >
            Schedule
          </Link>
          <Link
            href="/streams/roster"
            className="flex-1 rounded-full border border-slate-200 px-4 py-2 text-center text-xs font-semibold text-slate-600"
          >
            Roster
          </Link>
        </div>
        <div className="rounded-2xl border border-white/70 bg-white/70 p-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEndingSoon((prev) => !prev)}
              className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] transition ${
                endingSoon
                  ? "border-[var(--royal)] bg-blue-50 text-[var(--royal)]"
                  : "border-slate-200 text-slate-600"
              }`}
            >
              Ending soon
            </button>
            <div className="flex gap-2 overflow-x-auto">
              {["All", ...categories.map((category) => category.name)].map(
                (category) => (
                  <button
                    key={category}
                    onClick={() => setActiveCategory(category)}
                    className={`whitespace-nowrap rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] transition ${
                      activeCategory === category
                        ? "border-[var(--royal)] bg-blue-50 text-[var(--royal)]"
                        : "border-white/70 bg-white/70 text-slate-500"
                    }`}
                  >
                    {category}
                  </button>
                ),
              )}
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {loading && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 px-6 py-10 text-sm text-slate-500">
          Loading live listings...
        </div>
      )}

      <section className="space-y-5">
        {filteredStreams.map((stream) => {
          const imageUrl = getPrimaryImageUrl(stream);
          return (
            <Link
              key={stream.id}
              href={`/streams/${stream.id}`}
              className="block overflow-hidden rounded-[28px] border border-white/60 bg-white/85 shadow-[0_18px_40px_rgba(15,23,42,0.12)]"
            >
              <div className="relative h-44 overflow-hidden">
                <Image
                  src={imageUrl ?? "/streams/stream-1.svg"}
                  alt={stream.title}
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-[linear-gradient(to_top,_rgba(15,23,42,0.6),_transparent_60%)]" />
                <div className="absolute left-4 top-4 rounded-full bg-white/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-700">
                  {stream.listingType === "BUY_NOW"
                    ? "Buy now"
                    : "Live auction"}
                </div>
                <div className="absolute bottom-4 left-4 right-4 space-y-1 text-white">
                  <p className="font-display text-lg">{stream.title}</p>
                  <p className="text-xs text-white/70">
                    {stream.seller?.user?.displayName ?? "Verified seller"} ·{" "}
                    {stream.category?.name ?? "Collectible"}
                  </p>
                </div>
              </div>
              <div className="grid gap-3 p-4 text-sm text-slate-600">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                      Current
                    </p>
                  <p className="font-display text-lg text-slate-900">
                      {formatCurrency(
                        stream.currentBid,
                        stream.currency?.toUpperCase() ?? "USD",
                      )}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                      Time left
                    </p>
                    <p className="font-display text-lg text-[var(--royal)]">
                      {formatSeconds(getTimeLeftSeconds(stream))}
                    </p>
                  </div>
                </div>
                {stream.buyNowPrice ? (
                  <div className="flex items-center justify-between rounded-2xl border border-white/60 bg-white/80 px-3 py-2 text-xs">
                    <span>Buy now price</span>
                    <span className="font-semibold text-slate-900">
                      {formatCurrency(
                        stream.buyNowPrice,
                        stream.currency?.toUpperCase() ?? "USD",
                      )}
                    </span>
                  </div>
                ) : null}
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>{stream.watchersCount} watching</span>
                  <span className="font-semibold text-[var(--royal)]">
                    Enter live
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
