"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { signIn, useSession } from "next-auth/react";

type ForumAuthor = {
  id: string;
  displayName: string | null;
  image: string | null;
};

type ForumPostListItem = {
  id: string;
  title: string;
  body: string;
  status: "DRAFT" | "PUBLISHED";
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  author: ForumAuthor;
  _count: { comments: number };
};

function formatCompactDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function ForumClient() {
  const { data: session } = useSession();
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"published" | "drafts">("published");
  const [publishedPosts, setPublishedPosts] = useState<ForumPostListItem[]>([]);
  const [draftPosts, setDraftPosts] = useState<ForumPostListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchPosts = useCallback(async (q: string) => {
    setLoading(true);
    setError("");
    try {
      const publishedUrl = new URL("/api/forum/posts", window.location.origin);
      if (q.trim()) publishedUrl.searchParams.set("q", q.trim());
      const publishedResponse = await fetch(publishedUrl.toString());
      if (!publishedResponse.ok) {
        setError("Unable to load forum posts.");
        setLoading(false);
        return;
      }
      const publishedPayload = (await publishedResponse.json()) as ForumPostListItem[];
      setPublishedPosts(publishedPayload);

      if (session?.user?.id) {
        const draftsUrl = new URL("/api/forum/posts", window.location.origin);
        draftsUrl.searchParams.set("status", "draft");
        draftsUrl.searchParams.set("mine", "1");
        if (q.trim()) draftsUrl.searchParams.set("q", q.trim());
        const draftsResponse = await fetch(draftsUrl.toString());
        if (!draftsResponse.ok) {
          setError("Unable to load draft posts.");
          setLoading(false);
          return;
        }
        const draftsPayload = (await draftsResponse.json()) as ForumPostListItem[];
        setDraftPosts(draftsPayload);
      } else {
        setDraftPosts([]);
      }
      setLoading(false);
    } catch {
      setError("Unable to load forum posts.");
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchPosts("");
  }, [fetchPosts]);

  const filteredInfo = useMemo(() => {
    if (!query.trim()) return "Latest posts";
    return `Results for "${query.trim()}"`;
  }, [query]);

  const resolvedTab = session?.user?.id ? activeTab : "published";
  const activePosts = resolvedTab === "drafts" ? draftPosts : publishedPosts;

  const handleSearch = async () => {
    await fetchPosts(query);
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">
          Community
        </p>
        <h1 className="font-display text-3xl text-slate-900">Forum</h1>
      </div>

      <div className="surface-panel rounded-[28px] p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search posts..."
            className="w-full rounded-full border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-700 outline-none focus:border-[var(--royal)] sm:flex-1"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSearch}
              className="rounded-full bg-[var(--royal)] px-5 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-white shadow-lg shadow-blue-500/25"
            >
              Search
            </button>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                void fetchPosts("");
              }}
              className="rounded-full border border-slate-200 bg-white/90 px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600"
            >
              Reset
            </button>
          </div>
        </div>
        <div className="mt-3 text-xs text-slate-500">{filteredInfo}</div>
      </div>

      <div className="surface-panel rounded-[28px] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("published")}
                className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${
                  resolvedTab === "published"
                    ? "border-[var(--royal)] bg-blue-50 text-[var(--royal)]"
                    : "border-slate-200 text-slate-600"
                }`}
            >
              Published
            </button>
            {session?.user?.id && (
              <button
                type="button"
                onClick={() => setActiveTab("drafts")}
                className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${
                  resolvedTab === "drafts"
                    ? "border-[var(--royal)] bg-blue-50 text-[var(--royal)]"
                    : "border-slate-200 text-slate-600"
                }`}
              >
                My drafts
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {session?.user?.id ? (
              <Link
                href="/forum/new"
                className="rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-xs font-semibold text-slate-700"
              >
                Draft
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => signIn()}
                className="rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-xs font-semibold text-slate-700"
              >
                Sign in
              </button>
            )}
            <Link
              href="/forum/new"
              className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
            >
              Post thread
            </Link>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 px-6 py-10 text-sm text-slate-500">
          Loading posts...
        </div>
      ) : null}

      {!loading && activePosts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 px-6 py-10 text-sm text-slate-500">
          {resolvedTab === "drafts" ? "No drafts yet." : "No threads yet."}
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-2">
        {activePosts.map((post) => (
          <Link
            key={post.id}
            href={post.status === "DRAFT" ? `/forum/new?id=${post.id}` : `/forum/${post.id}`}
            className="group surface-panel rounded-[24px] p-3 transition hover:-translate-y-0.5 hover:shadow-[0_22px_60px_rgba(15,23,42,0.12)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  {formatCompactDate(post.createdAt)} ·{" "}
                  {post._count.comments} repl{post._count.comments === 1 ? "y" : "ies"}
                </p>
                <h3 className="mt-1 truncate text-base font-semibold text-slate-900">
                  {post.title}
                </h3>
                <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-600">
                  {post.body}
                </p>
              </div>
              <div className="shrink-0 rounded-2xl border border-white/70 bg-white/70 px-3 py-2 text-xs font-semibold text-slate-700">
                {post.status === "DRAFT" ? "Draft" : "Open"}
              </div>
            </div>
            <div className="mt-2 text-xs text-slate-500">
              by {post.author.displayName ?? "Member"}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
