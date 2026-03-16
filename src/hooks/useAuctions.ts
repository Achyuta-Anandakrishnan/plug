"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type AuctionListItem = {
  id: string;
  title: string;
  description: string | null;
  listingType: "AUCTION" | "BUY_NOW" | "BOTH";
  status: "DRAFT" | "SCHEDULED" | "LIVE" | "ENDED" | "CANCELED";
  currentBid: number;
  buyNowPrice: number | null;
  minBidIncrement: number;
  startTime: string | null;
  endTime: string | null;
  extendedTime: string | null;
  watchersCount: number;
  currency: string;
  createdAt?: string;
  category?: { name: string } | null;
  seller?: {
    status?: string;
    user?: { displayName: string | null; id: string } | null;
  } | null;
  streamSessions?: Array<{
    id: string;
    status: "CREATED" | "LIVE" | "ENDED" | "DISABLED";
    createdAt: string;
    updatedAt: string;
  }>;
  item?: {
    attributes?: Record<string, unknown> | null;
    images: { url: string; isPrimary: boolean }[];
  } | null;
};

type UseAuctionsOptions = {
  status?: string;
  category?: string;
  query?: string;
  view?: "streams" | "listings";
};

export function useAuctions(options: UseAuctionsOptions = {}) {
  const [data, setData] = useState<AuctionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const fetchAuctions = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (options.status) params.set("status", options.status);
      if (options.category) params.set("category", options.category);
      if (options.query) params.set("q", options.query);
      if (options.view) params.set("view", options.view);
      const response = await fetch(`/api/auctions?${params.toString()}`, { signal });
      if (!response.ok) {
        setError("Unable to load listings.");
        setLoading(false);
        return;
      }
      const payload = (await response.json()) as AuctionListItem[];
      setData(payload);
      setLoading(false);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      setError("Unable to load listings.");
      setLoading(false);
    }
  }, [options.category, options.query, options.status, options.view]);

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;

    const delay = options.query?.trim() ? 250 : 0;
    const timeout = window.setTimeout(() => {
      void fetchAuctions(controller.signal);
    }, delay);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [fetchAuctions, options.query]);

  const refresh = useCallback(async () => {
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    setLoading(true);
    setError("");
    await fetchAuctions(controller.signal);
  }, [fetchAuctions]);

  useEffect(() => () => abortRef.current?.abort(), []);

  return { data, loading, error, refresh };
}
