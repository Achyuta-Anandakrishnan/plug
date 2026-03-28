"use client";

import { useEffect, useRef, useState } from "react";
import type { PopScoreResult } from "@/lib/pop-score";

type Props = {
  auctionId?: string;
  itemName? : string;
  className?: string;
};

function tier(score: number) {
  if (score >= 80) return "elite";
  if (score >= 60) return "hot";
  if (score >= 40) return "scarce";
  if (score >= 20) return "active";
  return "common";
}

export function PopScoreBadge({ auctionId, itemName, className = "" }: Props) {
  const [result, setResult] = useState<PopScoreResult | null>(null);
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!auctionId && !itemName) return;
    const el = ref.current;
    if (!el) return;

    // Defer fetch until the badge scrolls into view — avoids N×requests on load
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();

        const params = new URLSearchParams();
        if (auctionId)      params.set("auctionId", auctionId);
        else if (itemName)  params.set("itemName",  itemName);

        fetch(`/api/pop-score?${params.toString()}`)
          .then((r) => r.json() as Promise<PopScoreResult>)
          .then((data) => { setResult(data); setLoaded(true); })
          .catch(() => { setLoaded(true); });
      },
      { rootMargin: "120px", threshold: 0 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [auctionId, itemName]);

  // Skeleton while waiting
  if (!loaded) {
    return (
      <span
        ref={ref}
        className={`pop-score-badge pop-score-skeleton ${className}`}
        aria-hidden="true"
      />
    );
  }

  if (!result) return <span ref={ref} />;

  const t     = tier(result.popScore);
  const flame = result.popScore >= 80 ? "🔥\u00A0" : "";
  const marketSummary = result.marketData
    ? [
        result.marketData.price != null ? `JustTCG $${result.marketData.price.toFixed(2)}` : null,
        result.marketData.priceChange7d != null ? `${result.marketData.priceChange7d >= 0 ? "+" : ""}${result.marketData.priceChange7d.toFixed(2)}% 7d` : null,
        result.marketData.setName ? result.marketData.setName : null,
      ]
        .filter(Boolean)
        .join(" • ")
    : "";
  const titleBase = `Market activity: ${result.label}. ${result.explanation}`;
  const title = marketSummary ? `${titleBase} • ${marketSummary}` : titleBase;

  return (
    <span
      ref={ref}
      className={`pop-score-badge pop-score-${t} ${className}`}
      title={title}
      aria-label={`Market activity ${result.label}${marketSummary ? ` — ${marketSummary}` : ""}`}
    >
      {flame}Market
      <span className="pop-score-label-text">{result.label}</span>
    </span>
  );
}
