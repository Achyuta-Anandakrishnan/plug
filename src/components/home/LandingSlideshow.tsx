"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

type Slide = {
  id: string;
  title: string;
  blurb: string;
  metric: string;
  metricLabel: string;
  image: string;
  bullets: string[];
};

const slides: Slide[] = [
  {
    id: "clean-flow",
    title: "Clean live flow",
    blurb: "Everything you need on one screen: item, chat, bids, and checkout.",
    metric: "4 steps",
    metricLabel: "List -> Go live -> Sell -> Payout",
    image: "/streams/stream-1.svg",
    bullets: [
      "Fast card scan",
      "Low-noise layout",
      "One-tap actions",
    ],
  },
  {
    id: "conversion",
    title: "Frictionless checkout",
    blurb: "Buy now and bidding stay in context so buyers move fast without losing detail.",
    metric: "2.3x",
    metricLabel: "Faster completion in live sessions",
    image: "/streams/stream-3.svg",
    bullets: [
      "Real-time bid path",
      "Direct seller chat",
      "Order timeline",
    ],
  },
  {
    id: "grading",
    title: "Category-ready cards",
    blurb: "Grade labels, cert info, and condition notes stay visible across views.",
    metric: "15",
    metricLabel: "Supported grading companies",
    image: "/streams/stream-5.svg",
    bullets: [
      "Exact grade options",
      "Cert-aware details",
      "Consistent search tags",
    ],
  },
];

function MiniDiagram({ index }: { index: number }) {
  const bars = useMemo(() => {
    if (index === 0) return [20, 35, 58, 72, 90];
    if (index === 1) return [25, 42, 61, 68, 83];
    return [18, 30, 47, 65, 79];
  }, [index]);

  return (
    <svg viewBox="0 0 240 96" className="h-20 w-full" aria-hidden="true">
      <rect x="0" y="0" width="240" height="96" rx="12" fill="rgba(255,255,255,0.65)" />
      {bars.map((height, idx) => (
        <rect
          key={idx}
          x={18 + idx * 42}
          y={90 - height}
          width="24"
          height={height}
          rx="6"
          fill={idx % 2 === 0 ? "#1d4ed8" : "#60a5fa"}
        />
      ))}
      <path d="M12 78 L54 62 L96 54 L138 43 L180 31 L222 24" stroke="#0f172a" strokeWidth="2" fill="none" strokeDasharray="4 4" />
    </svg>
  );
}

export function LandingSlideshow() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActive((prev) => (prev + 1) % slides.length);
    }, 4200);
    return () => window.clearInterval(timer);
  }, []);

  const slide = slides[active];

  return (
    <section className="surface-panel rounded-[32px] p-4 sm:p-6 lg:p-8">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
        <div className="space-y-4">
          <h2 className="font-display text-3xl text-slate-900 sm:text-4xl">{slide.title}</h2>
          <p className="text-sm leading-6 text-slate-600">{slide.blurb}</p>

          <div className="rounded-2xl border border-white/70 bg-white/80 p-3">
            <p className="font-display text-2xl text-slate-900">{slide.metric}</p>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{slide.metricLabel}</p>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            {slide.bullets.map((point) => (
              <div key={point} className="rounded-2xl border border-white/70 bg-white/70 px-3 py-2 text-xs text-slate-600">
                {point}
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            {slides.map((entry, index) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => setActive(index)}
                className={`h-2 rounded-full transition ${index === active ? "w-8 bg-[var(--royal)]" : "w-3 bg-slate-300"}`}
                aria-label={`Show slide ${index + 1}`}
              />
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="relative h-56 overflow-hidden rounded-3xl border border-white/70 bg-slate-900 sm:h-64">
            <Image
              src={slide.image}
              alt={slide.title}
              fill
              sizes="(max-width: 1024px) 100vw, 360px"
              className="object-cover"
              priority
            />
            <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(2,6,23,0.72),rgba(2,6,23,0.16))]" />
            <p className="absolute bottom-3 left-3 right-3 text-xs uppercase tracking-[0.2em] text-white/90">
              Live dashboard
            </p>
          </div>
          <MiniDiagram index={active} />
        </div>
      </div>
    </section>
  );
}
