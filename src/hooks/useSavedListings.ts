"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";

type SavePayload = {
  auctionIds: string[];
  tradePostIds: string[];
  bountyRequestIds?: string[];
  wantRequestIds: string[];
};

export function useSavedListings() {
  const { data: session } = useSession();
  const [auctionIds, setAuctionIds] = useState<Set<string>>(new Set());
  const [tradePostIds, setTradePostIds] = useState<Set<string>>(new Set());
  const [bountyRequestIds, setBountyRequestIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    async function load() {
        if (!session?.user?.id) {
        setAuctionIds(new Set());
        setTradePostIds(new Set());
        setBountyRequestIds(new Set());
        return;
      }

      const response = await fetch("/api/saves", { cache: "no-store" });
      if (!response.ok) return;
      const payload = (await response.json()) as SavePayload;
      if (cancelled) return;
      setAuctionIds(new Set(payload.auctionIds));
      setTradePostIds(new Set(payload.tradePostIds));
      setBountyRequestIds(new Set(payload.bountyRequestIds ?? payload.wantRequestIds ?? []));
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

  const toggleBountySave = useCallback(async (bountyRequestId: string) => {
    if (!session?.user?.id) return false;
    const isSaved = bountyRequestIds.has(bountyRequestId);
    const response = await fetch("/api/saves", {
      method: isSaved ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bountyRequestId }),
    });
    if (!response.ok) return false;
    setBountyRequestIds((prev) => {
      const next = new Set(prev);
      if (isSaved) next.delete(bountyRequestId);
      else next.add(bountyRequestId);
      return next;
    });
    return true;
  }, [bountyRequestIds, session?.user?.id]);

  return {
    isSignedIn: Boolean(session?.user?.id),
    auctionIds,
    tradePostIds,
    bountyRequestIds,
    wantRequestIds: bountyRequestIds,
    toggleAuctionSave,
    toggleTradeSave,
    toggleBountySave,
    toggleWantSave: toggleBountySave,
  };
}
