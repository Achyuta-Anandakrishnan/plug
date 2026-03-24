"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { resolveDisplayMediaUrl } from "@/lib/media-placeholders";

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
    const withPrimaryFirst = [...images]
      .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))
      .map((image) => ({
        ...image,
        url: resolveDisplayMediaUrl(image.url),
      }));
    return withPrimaryFirst;
  }, [images]);

  const [active, setActive] = useState(0);

  if (!ordered.length) return null;

  const activeImage = ordered[Math.min(active, ordered.length - 1)];

  return (
    <section className={`image-strip${compact ? " is-compact" : ""}`}>
      <div className="image-strip-head">
        <h3 className="image-strip-title">Listing photos</h3>
        <span className="app-eyebrow">Front / Back + extras</span>
      </div>

      <div className="image-strip-main">
        <Image
          src={activeImage.url}
          alt={imageLabel(active)}
          fill
          sizes="(max-width: 768px) 100vw, 340px"
          className="object-cover"
          unoptimized
        />
      </div>

      <div className="image-strip-rail">
        <div className="image-strip-thumbs">
          {ordered.map((image, index) => {
            const selected = index === active;
            return (
              <button
                key={`${image.url}-${index}`}
                type="button"
                onClick={() => setActive(index)}
                className={`image-strip-thumb${selected ? " is-active" : ""}`}
              >
                <Image
                  src={image.url}
                  alt={imageLabel(index)}
                  fill
                  sizes="96px"
                  className="object-cover"
                  unoptimized
                />
                <span className="image-strip-thumb-label">{imageLabel(index)}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
