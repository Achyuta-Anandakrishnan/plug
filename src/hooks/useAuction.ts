"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type AuctionDetail = {
  id: string;
  title: string;
  description: string | null;
  listingType: "AUCTION" | "BUY_NOW" | "BOTH";
  status: "DRAFT" | "SCHEDULED" | "LIVE" | "ENDED" | "CANCELED";
  startingBid: number;
  currentBid: number;
  minBidIncrement: number;
  buyNowPrice: number | null;
  reservePrice: number | null;
  startTime: string | null;
  endTime: string | null;
  extendedTime: string | null;
  antiSnipeSeconds: number;
  videoStreamUrl: string | null;
  currency: string;
  watchersCount: number;
  seller: {
    status: string;
    user: { displayName: string | null; id: string; image: string | null };
  };
  category?: { name: string } | null;
  item?: {
    description: string | null;
    condition: string | null;
    attributes?: Record<string, unknown> | null;
    images: { url: string; isPrimary: boolean }[];
  } | null;
  bids: { id: string; bidderId: string; amount: number; createdAt: string }[];
  chatMessages: {
    id: string;
    senderId: string;
    body: string;
    createdAt: string;
    sender: { displayName: string | null };
  }[];
};

export function useAuction(
  id: string,
  pollInterval = 5000,
  initialData?: AuctionDetail | null,
) {
  const [data, setData] = useState<AuctionDetail | null>(initialData ?? null);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const fetchAuction = useCallback(async ({
    poll = false,
    silent = false,
  }: { poll?: boolean; silent?: boolean } = {}) => {
    if (!id) return;
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    if (!silent) {
      setLoading(true);
    }
    try {
      const response = await fetch(`/api/auctions/${id}${poll ? "?poll=1" : ""}`, {
        signal: controller.signal,
      });
      if (!response.ok) {
        setError("Unable to load listing.");
        setLoading(false);
        return;
      }
      const payload = (await response.json()) as Partial<AuctionDetail>;
      setData((current) => {
        if (!current || !poll) {
          return payload as AuctionDetail;
        }
        return {
          ...current,
          ...payload,
          seller:
            payload.seller && "user" in payload.seller && payload.seller.user
              ? (payload.seller as AuctionDetail["seller"])
              : current.seller,
          category: payload.category ?? current.category,
          item: payload.item ?? current.item,
        };
      });
      setLoading(false);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      setError("Unable to load listing.");
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void fetchAuction({ poll: Boolean(initialData), silent: Boolean(initialData) });
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [fetchAuction, initialData]);

  useEffect(() => {
    if (!pollInterval) return;
    const interval = setInterval(() => {
      if (document.visibilityState === "hidden") return;
      void fetchAuction({ poll: true, silent: true });
    }, pollInterval);
    return () => clearInterval(interval);
  }, [fetchAuction, pollInterval]);

  useEffect(() => () => abortRef.current?.abort(), []);

  return { data, loading, error, refresh: fetchAuction };
}
