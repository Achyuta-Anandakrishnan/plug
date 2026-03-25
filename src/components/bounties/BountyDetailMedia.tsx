"use client";

import Image from "next/image";
import { useState } from "react";

type BountyDetailMediaProps = {
  title: string;
  itemName: string;
  imageUrl: string;
};

const FALLBACK_IMAGE = "/placeholders/pokemon-generic.svg";

export function BountyDetailMedia({
  title,
  itemName,
  imageUrl,
}: BountyDetailMediaProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const resolvedImage = imageUrl && failedSrc !== imageUrl ? imageUrl : FALLBACK_IMAGE;
  const hasImage = Boolean(imageUrl) && failedSrc !== imageUrl;

  return (
    <div className="bounty-detail-media">
      {hasImage ? (
        <Image
          src={resolvedImage}
          alt={title}
          fill
          sizes="(max-width: 768px) 100vw, 420px"
          className="bounty-detail-media-image"
          unoptimized
          onError={() => setFailedSrc(imageUrl)}
        />
      ) : (
        <div className="bounty-detail-media-fallback">
          <span className="listing-card-badge trade-status-chip is-open">Bounty</span>
          <strong>{itemName}</strong>
        </div>
      )}
    </div>
  );
}
