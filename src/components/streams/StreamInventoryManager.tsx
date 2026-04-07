"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type StreamQueueItem = {
  id: string;
  sourceType: "AUCTION" | "TRADE_POST";
  sourceId: string | null;
  linkedAuctionId: string | null;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  priceLabel: string | null;
  status: string;
  href: string | null;
};

type StreamCandidateItem = {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string | null;
  priceLabel: string | null;
};

type StreamInventoryPayload = {
  sessionId: string | null;
  queue: StreamQueueItem[];
  candidates: {
    auctions: StreamCandidateItem[];
    trades: StreamCandidateItem[];
  };
};

type StreamInventoryManagerProps = {
  auctionId: string;
  compact?: boolean;
};

function QueueCard({
  item,
  compact = false,
  busy,
  onRemove,
}: {
  item: StreamQueueItem;
  compact?: boolean;
  busy: boolean;
  onRemove: (id: string) => void;
}) {
  return (
    <article className={`stream-queue-card${compact ? " is-compact" : ""}`}>
      <div className="stream-queue-card-copy">
        <span className="stream-queue-card-badge">{item.sourceType === "TRADE_POST" ? "Trade to live" : "Listing ready"}</span>
        <strong className="stream-queue-card-title">{item.title}</strong>
        {item.subtitle ? <span className="stream-queue-card-meta">{item.subtitle}</span> : null}
        {item.priceLabel ? <span className="stream-queue-card-price">{item.priceLabel}</span> : null}
      </div>
      <div className="stream-queue-card-actions">
        {item.href ? (
          <Link href={item.href} className="stream-queue-link">
            Open
          </Link>
        ) : null}
        <button
          type="button"
          className="stream-queue-remove"
          onClick={() => onRemove(item.id)}
          disabled={busy}
        >
          Remove
        </button>
      </div>
    </article>
  );
}

function CandidateCard({
  item,
  label,
  busy,
  onAdd,
}: {
  item: StreamCandidateItem;
  label: string;
  busy: boolean;
  onAdd: (id: string) => void;
}) {
  return (
    <article className="stream-candidate-card">
      <div className="stream-candidate-copy">
        <strong className="stream-candidate-title">{item.title}</strong>
        <span className="stream-candidate-meta">{item.subtitle}</span>
        {item.priceLabel ? <span className="stream-candidate-price">{item.priceLabel}</span> : null}
      </div>
      <button
        type="button"
        className="stream-candidate-action"
        onClick={() => onAdd(item.id)}
        disabled={busy}
      >
        {label}
      </button>
    </article>
  );
}

export function StreamInventoryManager({
  auctionId,
  compact = false,
}: StreamInventoryManagerProps) {
  const [payload, setPayload] = useState<StreamInventoryPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyKey, setBusyKey] = useState("");

  const queuedAuctionIds = useMemo(
    () => new Set(
      (payload?.queue ?? [])
        .filter((item) => item.sourceType === "AUCTION")
        .map((item) => item.linkedAuctionId)
        .filter((value): value is string => Boolean(value)),
    ),
    [payload],
  );

  const queuedTradeIds = useMemo(
    () => new Set(
      (payload?.queue ?? [])
        .filter((item) => item.sourceType === "TRADE_POST")
        .map((item) => item.sourceId)
        .filter((value): value is string => Boolean(value)),
    ),
    [payload],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/streams/session/items?auctionId=${encodeURIComponent(auctionId)}`, {
        cache: "no-store",
      });
      const nextPayload = (await response.json()) as StreamInventoryPayload & { error?: string };
      if (!response.ok) {
        throw new Error(nextPayload.error || "Unable to load stream inventory.");
      }
      setPayload(nextPayload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load stream inventory.");
    } finally {
      setLoading(false);
    }
  }, [auctionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const mutate = useCallback(
    async (body: Record<string, unknown>, busyLabel: string) => {
      setBusyKey(busyLabel);
      setError("");
      try {
        const response = await fetch("/api/streams/session/items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ auctionId, ...body }),
        });
        const nextPayload = (await response.json()) as { error?: string };
        if (!response.ok) {
          throw new Error(nextPayload.error || "Unable to update stream inventory.");
        }
        await load();
      } catch (mutationError) {
        setError(mutationError instanceof Error ? mutationError.message : "Unable to update stream inventory.");
      } finally {
        setBusyKey("");
      }
    },
    [auctionId, load],
  );

  const queue = payload?.queue ?? [];
  const auctionCandidates = (payload?.candidates.auctions ?? []).filter((item) => !queuedAuctionIds.has(item.id));
  const tradeCandidates = (payload?.candidates.trades ?? []).filter((item) => !queuedTradeIds.has(item.id));

  return (
    <section className={`stream-inventory-panel${compact ? " is-compact" : ""}`}>
      <div className="stream-inventory-panel-head">
        <div>
          <p className="stream-inventory-kicker">Stream inventory</p>
          <h3 className="stream-inventory-title">Add items to sell live</h3>
        </div>
        <span className="stream-inventory-count">{queue.length} queued</span>
      </div>

      {error ? <p className="stream-inventory-note is-error">{error}</p> : null}

      {loading ? (
        <p className="stream-inventory-note">Loading inventory…</p>
      ) : (
        <>
          <div className="stream-inventory-section">
            <div className="stream-inventory-section-head">
              <span>Queued for this room</span>
            </div>
            {queue.length === 0 ? (
              <p className="stream-inventory-note">Nothing queued yet. Add listings or trades below.</p>
            ) : (
              <div className="stream-queue-list">
                {queue.map((item) => (
                  <QueueCard
                    key={item.id}
                    item={item}
                    compact={compact}
                    busy={busyKey === `remove:${item.id}`}
                    onRemove={(id) => void mutate({ action: "REMOVE", queueItemId: id }, `remove:${id}`)}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="stream-inventory-grid">
            <section className="stream-inventory-section">
              <div className="stream-inventory-section-head">
                <span>Your listings</span>
              </div>
              {auctionCandidates.length === 0 ? (
                <p className="stream-inventory-note">No listings available.</p>
              ) : (
                <div className="stream-candidate-list">
                  {auctionCandidates.slice(0, compact ? 4 : 8).map((item) => (
                    <CandidateCard
                      key={item.id}
                      item={item}
                      label="Add"
                      busy={busyKey === `auction:${item.id}`}
                      onAdd={(id) => void mutate({ sourceType: "AUCTION", sourceId: id }, `auction:${id}`)}
                    />
                  ))}
                </div>
              )}
            </section>

            <section className="stream-inventory-section">
              <div className="stream-inventory-section-head">
                <span>Trade inventory</span>
              </div>
              {tradeCandidates.length === 0 ? (
                <p className="stream-inventory-note">No open trades.</p>
              ) : (
                <div className="stream-candidate-list">
                  {tradeCandidates.slice(0, compact ? 4 : 8).map((item) => (
                    <CandidateCard
                      key={item.id}
                      item={item}
                      label="Sell live"
                      busy={busyKey === `trade:${item.id}`}
                      onAdd={(id) => void mutate({ sourceType: "TRADE_POST", sourceId: id }, `trade:${id}`)}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </section>
  );
}
