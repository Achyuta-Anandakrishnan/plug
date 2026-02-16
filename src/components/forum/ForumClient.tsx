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
  const [posts, setPosts] = useState<ForumPostListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const fetchPosts = useCallback(async (q: string) => {
    setLoading(true);
    setError("");
    try {
      const url = new URL("/api/forum/posts", window.location.origin);
      if (q.trim()) url.searchParams.set("q", q.trim());
      const response = await fetch(url.toString());
      if (!response.ok) {
        setError("Unable to load forum posts.");
        setLoading(false);
        return;
      }
      const payload = (await response.json()) as ForumPostListItem[];
      setPosts(payload);
      setLoading(false);
    } catch {
      setError("Unable to load forum posts.");
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchPosts("");
  }, [fetchPosts]);

  const filteredInfo = useMemo(() => {
    if (!query.trim()) return "Latest posts";
    return `Results for "${query.trim()}"`;
  }, [query]);

  const handleSearch = async () => {
    await fetchPosts(query);
  };

  const handleCreate = async () => {
    setCreateError("");
    if (!session?.user?.id) {
      await signIn();
      return;
    }
    const t = title.trim();
    const b = body.trim();
    if (t.length < 3) {
      setCreateError("Title must be at least 3 characters.");
      return;
    }
    if (b.length < 10) {
      setCreateError("Body must be at least 10 characters.");
      return;
    }

    setCreating(true);
    try {
      const response = await fetch("/api/forum/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: t, body: b }),
      });
      const payload = (await response.json()) as { error?: string } & ForumPostListItem;
      if (!response.ok) {
        setCreateError(payload.error || "Unable to create post.");
        setCreating(false);
        return;
      }
      setTitle("");
      setBody("");
      setPosts((prev) => [payload, ...prev]);
      setCreating(false);
    } catch {
      setCreateError("Unable to create post.");
      setCreating(false);
    }
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
                fetchPosts("");
              }}
              className="rounded-full border border-slate-200 bg-white/90 px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600"
            >
              Reset
            </button>
          </div>
        </div>
        <div className="mt-3 text-xs text-slate-500">{filteredInfo}</div>
      </div>

      <div className="surface-panel rounded-[28px] p-5">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-display text-lg text-slate-900">Start a thread</h2>
          {!session?.user?.id ? (
            <button
              type="button"
              onClick={() => signIn()}
              className="rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-xs font-semibold text-slate-700"
            >
              Sign in
            </button>
          ) : (
            <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Signed in
            </span>
          )}
        </div>
        <div className="mt-4 grid gap-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-700 outline-none focus:border-[var(--royal)]"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="What are you looking for, selling, or discussing?"
            className="min-h-28 w-full resize-y rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-700 outline-none focus:border-[var(--royal)]"
          />
          {createError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {createError}
            </div>
          ) : null}
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating}
            className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {creating ? "Posting..." : "Post thread"}
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 px-6 py-10 text-sm text-slate-500">
          Loading threads...
        </div>
      ) : null}

      {!loading && posts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 px-6 py-10 text-sm text-slate-500">
          No threads yet.
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-2">
        {posts.map((post) => (
          <Link
            key={post.id}
            href={`/forum/${post.id}`}
            className="group surface-panel rounded-[28px] p-5 transition hover:-translate-y-0.5 hover:shadow-[0_22px_60px_rgba(15,23,42,0.12)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.25em] text-slate-400">
                  {formatCompactDate(post.createdAt)} ·{" "}
                  {post._count.comments} repl{post._count.comments === 1 ? "y" : "ies"}
                </p>
                <h3 className="mt-2 font-display text-xl text-slate-900 truncate">
                  {post.title}
                </h3>
                <p className="mt-2 line-clamp-3 text-sm text-slate-600">
                  {post.body}
                </p>
              </div>
              <div className="shrink-0 rounded-2xl border border-white/70 bg-white/70 px-3 py-2 text-xs font-semibold text-slate-700">
                Open
              </div>
            </div>
            <div className="mt-4 text-xs text-slate-500">
              by {post.author.displayName ?? "Member"}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

