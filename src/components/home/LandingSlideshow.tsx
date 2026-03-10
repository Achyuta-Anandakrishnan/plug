"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type Slide = {
  id: string;
  title: string;
  blurb: string;
  metric: string;
  metricLabel: string;
  image: string;
};

const slides: Slide[] = [
  {
    id: "clean-flow",
    title: "Clean live flow",
    blurb: "Everything in one place.",
    metric: "4 steps",
    metricLabel: "List -> Go live -> Sell -> Payout",
    image: "/charts/market-line.svg",
  },
  {
    id: "conversion",
    title: "Frictionless checkout",
    blurb: "Bids and buy-now stay in context.",
    metric: "2.3x",
    metricLabel: "Faster completion in live sessions",
    image: "/charts/market-candles.svg",
  },
  {
    id: "grading",
    title: "Category-ready cards",
    blurb: "Details stay visible across views.",
    metric: "15",
    metricLabel: "Supported grading companies",
    image: "/charts/market-line.svg",
  },
];

export function LandingSlideshow() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActive((prev) => (prev + 1) % slides.length);
    }, 4200);
    return () => window.clearInterval(timer);
  }, []);

  const slide = slides[active];
  const secondary = slides[(active + 1) % slides.length];

  return (
    <section className="surface-panel rounded-[28px] p-3 sm:p-4 lg:p-5">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center">
        <div className="space-y-3">
          <h2 className="font-display text-2xl text-slate-900 sm:text-3xl">{slide.title}</h2>
          <p className="text-sm leading-6 text-slate-600">{slide.blurb}</p>

          <div className="rounded-2xl border border-white/70 bg-white/80 p-3">
            <p className="font-display text-xl text-slate-900">{slide.metric}</p>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{slide.metricLabel}</p>
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

        <div className="grid gap-2">
          <div className="relative h-40 overflow-hidden rounded-2xl border border-white/70 bg-black sm:h-48">
            <Image
              src={slide.image}
              alt={slide.title}
              fill
              sizes="(max-width: 1024px) 100vw, 320px"
              className="object-cover"
              priority
            />
            <div className="absolute inset-0 bg-black/25" />
          </div>
          <div className="relative h-24 overflow-hidden rounded-2xl border border-white/70 bg-black sm:h-28">
            <Image
              src={secondary.image}
              alt={secondary.title}
              fill
              sizes="(max-width: 1024px) 100vw, 320px"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-black/25" />
          </div>
        </div>
      </div>
    </section>
  );
}
