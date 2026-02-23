"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

type ListingImageStripProps = {
  images: { url: string; isPrimary: boolean }[];
  compact?: boolean;
};

function imageLabel(index: number) {
  if (index === 0) return "Front";
  if (index === 1) return "Back";
  return `Image ${index + 1}`;
}

export function ListingImageStrip({ images, compact = false }: ListingImageStripProps) {
  const ordered = useMemo(() => {
    const withPrimaryFirst = [...images].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));
    return withPrimaryFirst;
  }, [images]);

  const [active, setActive] = useState(0);

  if (!ordered.length) return null;

  const activeImage = ordered[Math.min(active, ordered.length - 1)];

  return (
    <section className={`surface-panel rounded-3xl ${compact ? "p-3" : "p-4"}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="font-display text-lg text-slate-900">Listing photos</h3>
        <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Front / Back + extras</span>
      </div>

      <div className={`relative overflow-hidden rounded-2xl border border-white/70 bg-slate-900 ${compact ? "h-44" : "h-52"}`}>
        <Image
          src={activeImage.url}
          alt={imageLabel(active)}
          fill
          sizes="(max-width: 768px) 100vw, 340px"
          className="object-cover"
          unoptimized
        />
      </div>

      <div className="mt-3 overflow-x-auto pb-1">
        <div className="flex min-w-max gap-2">
          {ordered.map((image, index) => {
            const selected = index === active;
            return (
              <button
                key={`${image.url}-${index}`}
                type="button"
                onClick={() => setActive(index)}
                className={`group relative h-16 w-24 overflow-hidden rounded-xl border text-left ${
                  selected ? "border-[var(--royal)]" : "border-slate-200"
                }`}
              >
                <Image
                  src={image.url}
                  alt={imageLabel(index)}
                  fill
                  sizes="96px"
                  className="object-cover"
                  unoptimized
                />
                <span className="absolute bottom-0 left-0 right-0 bg-slate-950/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white">
                  {imageLabel(index)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
