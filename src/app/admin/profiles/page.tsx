"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type AdminProfile = {
  id: string;
  email: string | null;
  username: string | null;
  displayName: string | null;
  bio: string | null;
  image: string | null;
  role: string;
  createdAt: string;
  sellerProfile: {
    status: string;
    trustTier: number;
  } | null;
};

export default function AdminProfilesPage() {
  const [profiles, setProfiles] = useState<AdminProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  const fetchProfiles = async (q = "") => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      params.set("limit", "1000");
      if (q.trim()) params.set("q", q.trim());
      const response = await fetch(`/api/admin/profiles?${params.toString()}`);
      const data = (await response.json()) as AdminProfile[] & { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Unable to load profiles.");
      }
      setProfiles(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load profiles.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchProfiles();
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
          Admin desk
        </p>
        <h1 className="font-display text-3xl text-slate-900">
          All profiles
        </h1>
        <p className="text-sm text-slate-600">
          View and search every account profile.
        </p>
      </div>

      <div className="surface-panel rounded-[28px] p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/sellers"
              className="rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-xs font-semibold text-slate-700"
            >
              Seller Queue
            </Link>
            <Link
              href="/admin/profiles"
              className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
            >
              Profiles
            </Link>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search username, email, display name"
              className="rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-sm text-slate-700 outline-none"
            />
            <button
              type="button"
              onClick={() => void fetchProfiles(query)}
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            >
              Search
            </button>
          </div>
        </div>
        {error ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-600">
            {error}
          </div>
        ) : null}
      </div>

      {loading ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 px-6 py-10 text-sm text-slate-500">
          Loading profiles...
        </div>
      ) : (
        <section className="grid gap-3 lg:grid-cols-2">
          {profiles.map((profile) => (
            <div
              key={profile.id}
              className="surface-panel rounded-[24px] p-4 text-sm text-slate-600"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-base font-semibold text-slate-900">
                    {profile.displayName ?? "User"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {profile.username ? `@${profile.username}` : "No username"}
                  </p>
                  <p className="text-xs text-slate-500">{profile.email ?? "No email"}</p>
                </div>
                <div className="rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-slate-500">
                  {profile.role}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-slate-600">
                  Seller: {profile.sellerProfile?.status ?? "N/A"}
                </span>
                <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-slate-600">
                  Trust tier: {profile.sellerProfile?.trustTier ?? "-"}
                </span>
              </div>
              {profile.bio ? (
                <p className="mt-3 line-clamp-2 text-xs text-slate-500">{profile.bio}</p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href={profile.username ? `/u/${profile.username}` : `/profiles/${profile.id}`}
                  className="rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 text-xs font-semibold text-slate-700"
                >
                  Open profile
                </Link>
                <Link
                  href={`/messages`}
                  className="rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 text-xs font-semibold text-slate-700"
                >
                  Open messages
                </Link>
              </div>
            </div>
          ))}
          {!profiles.length && !error ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 px-6 py-10 text-sm text-slate-500">
              No profiles found.
            </div>
          ) : null}
        </section>
      )}
    </div>
  );
}
