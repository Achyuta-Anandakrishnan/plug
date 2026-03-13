"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { LiveStreamItem } from "@/components/live/types";
import {
  streamCategory,
  streamHost,
  streamImage,
  streamPriceLabel,
  streamTimeLabel,
  streamType,
  streamTypeLabel,
} from "@/components/live/utils";

type LiveStreamCardProps = {
  stream: LiveStreamItem;
  layout: "featured" | "grid" | "compact";
  showScheduleAction?: boolean;
  reminderOn?: boolean;
  onToggleReminder?: (streamId: string) => void;
};

export function LiveStreamCard({
  stream,
  layout,
  showScheduleAction = false,
  reminderOn = false,
  onToggleReminder,
}: LiveStreamCardProps) {
  const fallbackImage = "/placeholders/pokemon-generic.svg";
  const image = useMemo(() => streamImage(stream), [stream]);
  const [imageSrc, setImageSrc] = useState(image);

  useEffect(() => {
    setImageSrc(image);
  }, [image]);

  const host = streamHost(stream);
  const category = streamCategory(stream);
  const typeLabel = streamTypeLabel(streamType(stream));
  const stateLabel = stream.streamState === "live" ? "Live" : "Scheduled";
  const joinLabel = stream.streamState === "live" ? "Join stream" : "View room";

  const sizes = layout === "featured"
    ? "(max-width: 1100px) 100vw, 720px"
    : layout === "compact"
      ? "(max-width: 1100px) 100vw, 340px"
      : "(max-width: 1100px) 100vw, 320px";

  return (
    <article className={`live-v3-stream-card is-${layout} ${stream.streamState === "live" ? "is-live" : "is-upcoming"}`}>
      <Link href={`/streams/${stream.id}`} className="live-v3-stream-link">
        <div className="live-v3-stream-media">
          <Image
            src={imageSrc}
            alt={`${stream.title} thumbnail`}
            fill
            sizes={sizes}
            className="object-cover"
            unoptimized
            onError={() => {
              if (imageSrc !== fallbackImage) setImageSrc(fallbackImage);
            }}
          />
          <div className="live-v3-stream-media-overlay" />
          <div className="live-v3-stream-top">
            <span className={`live-v3-live-pill ${stream.streamState === "live" ? "is-live" : "is-upcoming"}`}>{stateLabel}</span>
            <span className="live-v3-viewers-pill">{stream.watchersCount} watching</span>
          </div>
        </div>

        <div className="live-v3-stream-body">
          <h3>{stream.title}</h3>
          <div className="live-v3-stream-subline">
            <span>{host}</span>
            <span>{category}</span>
          </div>
          <div className="live-v3-stream-meta">
            <span>{streamPriceLabel(stream)}</span>
            <span>{streamTimeLabel(stream)}</span>
          </div>
          <div className="live-v3-stream-foot">
            <span className="live-v3-stream-type">{typeLabel}</span>
            <span className="live-v3-enter-pill">{joinLabel}</span>
          </div>
        </div>
      </Link>

      {showScheduleAction && onToggleReminder ? (
        <button
          type="button"
          className={`live-v3-reminder-btn ${reminderOn ? "is-active" : ""}`}
          onClick={() => onToggleReminder(stream.id)}
        >
          {reminderOn ? "Reminder set" : "Set reminder"}
        </button>
      ) : null}
    </article>
  );
}
