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
    <section className="landing-slideshow">
      <div className="landing-slideshow-layout">
        <div className="landing-slideshow-copy">
          <h2 className="landing-slideshow-title">{slide.title}</h2>
          <p className="landing-slideshow-blurb">{slide.blurb}</p>

          <div className="landing-slideshow-metric">
            <p className="landing-slideshow-metric-value">{slide.metric}</p>
            <p className="app-eyebrow">{slide.metricLabel}</p>
          </div>

          <div className="landing-slideshow-dots">
            {slides.map((entry, index) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => setActive(index)}
                className={`landing-slideshow-dot${index === active ? " is-active" : ""}`}
                aria-label={`Show slide ${index + 1}`}
              />
            ))}
          </div>
        </div>

        <div className="landing-slideshow-media">
          <div className="landing-slideshow-img-primary">
            <Image
              src="/placeholders/checkerboard.svg"
              alt={slide.title}
              fill
              sizes="(max-width: 1024px) 100vw, 320px"
              className="object-cover"
              priority
            />
            <div className="landing-slideshow-img-overlay" aria-hidden="true" />
          </div>
          <div className="landing-slideshow-img-secondary">
            <Image
              src="/placeholders/checkerboard.svg"
              alt={secondary.title}
              fill
              sizes="(max-width: 1024px) 100vw, 320px"
              className="object-cover"
            />
            <div className="landing-slideshow-img-overlay" aria-hidden="true" />
          </div>
        </div>
      </div>
    </section>
  );
}
