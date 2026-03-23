"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";

type SavePayload = {
  auctionIds: string[];
  tradePostIds: string[];
  wantRequestIds: string[];
};

export function useSavedListings() {
  const { data: session } = useSession();
  const [auctionIds, setAuctionIds] = useState<Set<string>>(new Set());
  const [tradePostIds, setTradePostIds] = useState<Set<string>>(new Set());
  const [wantRequestIds, setWantRequestIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    async function load() {
        if (!session?.user?.id) {
        setAuctionIds(new Set());
        setTradePostIds(new Set());
        setWantRequestIds(new Set());
        return;
      }

      const response = await fetch("/api/saves", { cache: "no-store" });
      if (!response.ok) return;
      const payload = (await response.json()) as SavePayload;
      if (cancelled) return;
      setAuctionIds(new Set(payload.auctionIds));
      setTradePostIds(new Set(payload.tradePostIds));
      setWantRequestIds(new Set(payload.wantRequestIds));
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  const toggleAuctionSave = useCallback(async (auctionId: string) => {
    if (!session?.user?.id) return false;
    const isSaved = auctionIds.has(auctionId);
    const response = await fetch("/api/saves", {
      method: isSaved ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ auctionId }),
    });
    if (!response.ok) return false;
    setAuctionIds((prev) => {
      const next = new Set(prev);
      if (isSaved) next.delete(auctionId);
      else next.add(auctionId);
      return next;
    });
    return true;
  }, [auctionIds, session?.user?.id]);

  const toggleTradeSave = useCallback(async (tradePostId: string) => {
    if (!session?.user?.id) return false;
    const isSaved = tradePostIds.has(tradePostId);
    const response = await fetch("/api/saves", {
      method: isSaved ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tradePostId }),
    });
    if (!response.ok) return false;
    setTradePostIds((prev) => {
      const next = new Set(prev);
      if (isSaved) next.delete(tradePostId);
      else next.add(tradePostId);
      return next;
    });
    return true;
  }, [tradePostIds, session?.user?.id]);

  const toggleWantSave = useCallback(async (wantRequestId: string) => {
    if (!session?.user?.id) return false;
    const isSaved = wantRequestIds.has(wantRequestId);
    const response = await fetch("/api/saves", {
      method: isSaved ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wantRequestId }),
    });
    if (!response.ok) return false;
    setWantRequestIds((prev) => {
      const next = new Set(prev);
      if (isSaved) next.delete(wantRequestId);
      else next.add(wantRequestId);
      return next;
    });
    return true;
  }, [wantRequestIds, session?.user?.id]);

  return {
    isSignedIn: Boolean(session?.user?.id),
    auctionIds,
    tradePostIds,
    wantRequestIds,
    toggleAuctionSave,
    toggleTradeSave,
    toggleWantSave,
  };
}
