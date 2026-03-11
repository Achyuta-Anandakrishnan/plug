"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { LiveStreamItem } from "@/components/live/types";
import { streamCategory, streamHost, streamImage, streamPriceLabel, streamTimeLabel, streamType, streamTypeLabel } from "@/components/live/utils";

type LiveStreamCardProps = {
  stream: LiveStreamItem;
  layout: "rail" | "grid";
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

  return (
    <article className={`live-v3-stream-card ${layout === "rail" ? "is-rail" : "is-grid"} ${stream.streamState === "live" ? "is-live" : "is-upcoming"}`}>
      <Link href={`/streams/${stream.id}`} className="live-v3-stream-link">
        <div className="live-v3-stream-media">
          <Image
            src={imageSrc}
            alt="Live stream thumbnail"
            fill
            sizes={layout === "rail" ? "(max-width: 1024px) 80vw, 360px" : "(max-width: 1024px) 60vw, 420px"}
            className="object-cover"
            unoptimized
            onError={() => {
              if (imageSrc !== fallbackImage) setImageSrc(fallbackImage);
            }}
          />
          <div className="live-v3-stream-media-overlay" />
          <div className="live-v3-stream-top">
            <span className={`live-v3-live-pill ${stream.streamState === "live" ? "is-live" : "is-upcoming"}`}>{stateLabel}</span>
            {stream.streamState === "live" ? (
              <span className="live-v3-viewers-pill">{stream.watchersCount} watching</span>
            ) : null}
          </div>
        </div>

        <div className="live-v3-stream-body">
          <h3>{stream.title}</h3>
          <p>{host}</p>
          <div className="live-v3-stream-tags">
            <span>{category}</span>
            <span>{typeLabel}</span>
            <span>{streamPriceLabel(stream)}</span>
          </div>
          <div className="live-v3-stream-foot">
            <span>{streamTimeLabel(stream)}</span>
            <span className="live-v3-enter-pill">{stream.streamState === "live" ? "Join stream" : "View room"}</span>
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
