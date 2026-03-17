"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";

type FollowsPayload = {
  counts: Record<string, number>;
  followedIds: string[];
};

export function useUserFollows(userIds: string[]) {
  const { data: session } = useSession();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const stableIds = useMemo(
    () => [...new Set(userIds.filter(Boolean))].sort(),
    [userIds],
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (stableIds.length === 0) {
        setCounts({});
        setFollowedIds(new Set());
        return;
      }

      const params = new URLSearchParams({ ids: stableIds.join(",") });
      const response = await fetch(`/api/follows?${params.toString()}`, { cache: "no-store" });
      if (!response.ok) return;
      const payload = (await response.json()) as FollowsPayload;
      if (cancelled) return;
      setCounts(payload.counts);
      setFollowedIds(new Set(payload.followedIds));
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [stableIds, session?.user?.id]);

  const toggleFollow = useCallback(async (followingId: string) => {
    if (!session?.user?.id) return false;
    const isFollowing = followedIds.has(followingId);
    const response = await fetch("/api/follows", {
      method: isFollowing ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ followingId }),
    });
    if (!response.ok) return false;
    setFollowedIds((prev) => {
      const next = new Set(prev);
      if (isFollowing) next.delete(followingId);
      else next.add(followingId);
      return next;
    });
    setCounts((prev) => ({
      ...prev,
      [followingId]: Math.max(0, (prev[followingId] ?? 0) + (isFollowing ? -1 : 1)),
    }));
    return true;
  }, [followedIds, session?.user?.id]);

  return {
    isSignedIn: Boolean(session?.user?.id),
    counts,
    followedIds,
    toggleFollow,
  };
}
