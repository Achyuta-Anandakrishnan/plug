"use client";

import { useCallback, useEffect, useState } from "react";

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
  category?: { name: string } | null;
  seller?: {
    status?: string;
    user?: { displayName: string | null; id: string } | null;
  } | null;
  item?: {
    images: { url: string; isPrimary: boolean }[];
  } | null;
};

type UseAuctionsOptions = {
  status?: string;
  category?: string;
};

export function useAuctions(options: UseAuctionsOptions = {}) {
  const [data, setData] = useState<AuctionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchAuctions = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (options.status) params.set("status", options.status);
      if (options.category) params.set("category", options.category);
      const response = await fetch(`/api/auctions?${params.toString()}`);
      if (!response.ok) {
        setError("Unable to load listings.");
        setLoading(false);
        return;
      }
      const payload = (await response.json()) as AuctionListItem[];
      setData(payload);
      setLoading(false);
    } catch {
      setError("Unable to load listings.");
      setLoading(false);
    }
  }, [options.category, options.status]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAuctions();
  }, [fetchAuctions]);

  return { data, loading, error, refresh: fetchAuctions };
}
