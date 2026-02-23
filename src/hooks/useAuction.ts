"use client";

import { useCallback, useEffect, useState } from "react";

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
    user: { displayName: string | null; id: string };
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

  const fetchAuction = useCallback(async () => {
    if (!id) return;
    try {
      const response = await fetch(`/api/auctions/${id}`);
      if (!response.ok) {
        setError("Unable to load listing.");
        setLoading(false);
        return;
      }
      const payload = (await response.json()) as AuctionDetail;
      setData(payload);
      setLoading(false);
    } catch {
      setError("Unable to load listing.");
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAuction();
  }, [fetchAuction]);

  useEffect(() => {
    if (!pollInterval) return;
    const interval = setInterval(() => {
      fetchAuction();
    }, pollInterval);
    return () => clearInterval(interval);
  }, [fetchAuction, pollInterval]);

  return { data, loading, error, refresh: fetchAuction };
}
