"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";

type ReminderPayload = {
  auctionIds: string[];
};

export function useStreamReminders() {
  const { data: session } = useSession();
  const [auctionIds, setAuctionIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!session?.user?.id) {
        setAuctionIds(new Set());
        return;
      }

      const response = await fetch("/api/stream-reminders", { cache: "no-store" });
      if (!response.ok) return;
      const payload = (await response.json()) as ReminderPayload;
      if (cancelled) return;
      setAuctionIds(new Set(payload.auctionIds));
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  const toggleReminder = useCallback(async (auctionId: string) => {
    if (!session?.user?.id) return false;
    const isSaved = auctionIds.has(auctionId);
    const response = await fetch("/api/stream-reminders", {
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

  return {
    isSignedIn: Boolean(session?.user?.id),
    auctionIds,
    toggleReminder,
  };
}
