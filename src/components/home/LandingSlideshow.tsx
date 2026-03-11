"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type Slide = {
  id: string;
  title: string;
  blurb: string;
  metric: string;
  metricLabel: string;
};

const slides: Slide[] = [
  {
    id: "clean-flow",
    title: "Unified market board",
    blurb: "Stream, bid, and buy-now in one flow.",
    metric: "3 modes",
    metricLabel: "Buy now · Auctions · Live",
  },
  {
    id: "latency",
    title: "Live-first discovery",
    blurb: "Only active streams surface in the rail.",
    metric: "Live only",
    metricLabel: "No stale scheduled clutter",
  },
  {
    id: "checkout",
    title: "Faster checkout path",
    blurb: "Keep context while moving from card to payment.",
    metric: "One tap",
    metricLabel: "Stripe flow in feed",
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
                className={`h-2 rounded-full transition ${index === active ? "w-8 bg-slate-900" : "w-3 bg-slate-300"}`}
                aria-label={`Show slide ${index + 1}`}
              />
            ))}
          </div>
        </div>

        <div className="grid gap-2">
          <div className="relative h-40 overflow-hidden rounded-2xl border border-white/70 bg-black sm:h-48">
            <Image
              src="/placeholders/checkerboard.svg"
              alt={slide.title}
              fill
              sizes="(max-width: 1024px) 100vw, 320px"
              className="object-cover"
              priority
            />
            <div className="absolute inset-0 bg-black/30" />
          </div>
          <div className="relative h-24 overflow-hidden rounded-2xl border border-white/70 bg-black sm:h-28">
            <Image
              src="/placeholders/checkerboard.svg"
              alt={secondary.title}
              fill
              sizes="(max-width: 1024px) 100vw, 320px"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-black/36" />
          </div>
        </div>
      </div>
    </section>
  );
}
