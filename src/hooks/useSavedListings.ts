"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

type SavePayload = {
  auctionIds: string[];
  tradePostIds: string[];
  bountyRequestIds?: string[];
  wantRequestIds: string[];
};

type CachedSavePayload = SavePayload & {
  fetchedAt: number;
};

const SAVES_CACHE_TTL_MS = 60_000;

function cacheKey(userId: string) {
  return `saved-listings:${userId}`;
}

function readCachedPayload(userId: string): CachedSavePayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(cacheKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedSavePayload;
    if (!parsed || typeof parsed.fetchedAt !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCachedPayload(userId: string, payload: SavePayload) {
  if (typeof window === "undefined") return;
  try {
    const next: CachedSavePayload = {
      ...payload,
      fetchedAt: Date.now(),
    };
    window.sessionStorage.setItem(cacheKey(userId), JSON.stringify(next));
  } catch {
    // Ignore storage failures.
  }
}

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

      const cached = readCachedPayload(session.user.id);
      if (cached && Date.now() - cached.fetchedAt < SAVES_CACHE_TTL_MS) {
        setAuctionIds(new Set(cached.auctionIds));
        setTradePostIds(new Set(cached.tradePostIds));
        setBountyRequestIds(new Set(cached.bountyRequestIds ?? cached.wantRequestIds ?? []));
        return;
      }

      const response = await fetch("/api/saves", { cache: "no-store" });
      if (!response.ok) return;
      const payload = (await response.json()) as SavePayload;
      if (cancelled) return;
      writeCachedPayload(session.user.id, payload);
      setAuctionIds(new Set(payload.auctionIds));
      setTradePostIds(new Set(payload.tradePostIds));
      setBountyRequestIds(new Set(payload.bountyRequestIds ?? payload.wantRequestIds ?? []));
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  async function toggleAuctionSave(auctionId: string) {
    if (!session?.user?.id) return false;
    const isSaved = auctionIds.has(auctionId);
    const response = await fetch("/api/saves", {
      method: isSaved ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ auctionId }),
    });
    if (!response.ok) return false;
    writeCachedPayload(session.user.id, {
      auctionIds: isSaved ? [...auctionIds].filter((id) => id !== auctionId) : [...auctionIds, auctionId],
      tradePostIds: [...tradePostIds],
      bountyRequestIds: [...bountyRequestIds],
      wantRequestIds: [...bountyRequestIds],
    });
    setAuctionIds((prev) => {
      const next = new Set(prev);
      if (isSaved) next.delete(auctionId);
      else next.add(auctionId);
      return next;
    });
    return true;
  }

  async function toggleTradeSave(tradePostId: string) {
    if (!session?.user?.id) return false;
    const isSaved = tradePostIds.has(tradePostId);
    const response = await fetch("/api/saves", {
      method: isSaved ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tradePostId }),
    });
    if (!response.ok) return false;
    writeCachedPayload(session.user.id, {
      auctionIds: [...auctionIds],
      tradePostIds: isSaved ? [...tradePostIds].filter((id) => id !== tradePostId) : [...tradePostIds, tradePostId],
      bountyRequestIds: [...bountyRequestIds],
      wantRequestIds: [...bountyRequestIds],
    });
    setTradePostIds((prev) => {
      const next = new Set(prev);
      if (isSaved) next.delete(tradePostId);
      else next.add(tradePostId);
      return next;
    });
    return true;
  }

  async function toggleBountySave(bountyRequestId: string) {
    if (!session?.user?.id) return false;
    const isSaved = bountyRequestIds.has(bountyRequestId);
    const response = await fetch("/api/saves", {
      method: isSaved ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bountyRequestId }),
    });
    if (!response.ok) return false;
    const nextBountyIds = isSaved
      ? [...bountyRequestIds].filter((id) => id !== bountyRequestId)
      : [...bountyRequestIds, bountyRequestId];
    writeCachedPayload(session.user.id, {
      auctionIds: [...auctionIds],
      tradePostIds: [...tradePostIds],
      bountyRequestIds: nextBountyIds,
      wantRequestIds: nextBountyIds,
    });
    setBountyRequestIds((prev) => {
      const next = new Set(prev);
      if (isSaved) next.delete(bountyRequestId);
      else next.add(bountyRequestId);
      return next;
    });
    return true;
  }

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
