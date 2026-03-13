"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { CheckersLoader } from "@/components/CheckersLoader";

type ForumAuthor = {
  id: string;
  username: string | null;
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
  voteScore: number;
  myVote: number;
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
  const [draftWarning, setDraftWarning] = useState("");

  const fetchPosts = useCallback(async (q: string) => {
    setLoading(true);
    setError("");
    setDraftWarning("");
    try {
      const publishedUrl = new URL("/api/forum/posts", window.location.origin);
      if (q.trim()) publishedUrl.searchParams.set("q", q.trim());
      const publishedResponse = await fetch(publishedUrl.toString(), {
        cache: "no-store",
      });
      const publishedPayload = (await publishedResponse.json()) as ForumPostListItem[] & { error?: string };
      if (!publishedResponse.ok) {
        if (publishedPayload.error?.toLowerCase().includes("forum database is not ready")) {
          setPublishedPosts([]);
          setLoading(false);
          return;
        }
        setError(publishedPayload.error || "Unable to load forum posts.");
        setLoading(false);
        return;
      }
      setPublishedPosts(publishedPayload);

      if (session?.user?.id) {
        const draftsUrl = new URL("/api/forum/posts", window.location.origin);
        draftsUrl.searchParams.set("status", "draft");
        draftsUrl.searchParams.set("mine", "1");
        if (q.trim()) draftsUrl.searchParams.set("q", q.trim());
        const draftsResponse = await fetch(draftsUrl.toString(), {
          cache: "no-store",
        });
        const draftsPayload = (await draftsResponse.json()) as ForumPostListItem[] & { error?: string };
        if (draftsResponse.ok) {
          setDraftPosts(draftsPayload);
        } else {
          setDraftPosts([]);
          setDraftWarning(draftsPayload.error || "Unable to load draft posts right now.");
        }
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
    <div className="ios-screen product-shell forum-page">
      <section className="product-page-header">
        <div className="product-page-intro">
          <h1 className="product-page-title">Forum</h1>
          <p className="product-page-copy">Questions, market talk, and collector intel in one feed.</p>
        </div>
        <div className="forum-header-actions">
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
            className="product-page-primary"
          >
            Post thread
          </Link>
        </div>
      </section>

      <section className="product-toolbar forum-toolbar">
        <div className="forum-search-row">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search posts..."
            className="ios-input sm:flex-1"
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void handleSearch();
              }
            }}
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
              Clear
            </button>
          </div>
        </div>
        <div className="forum-filter-row">
          <div className="ios-chip-row">
            <button
              type="button"
              onClick={() => setActiveTab("published")}
              className={`ios-chip ${resolvedTab === "published" ? "ios-chip-active" : ""}`}
            >
              Published
            </button>
            {session?.user?.id && (
              <button
                type="button"
                onClick={() => setActiveTab("drafts")}
                className={`ios-chip ${resolvedTab === "drafts" ? "ios-chip-active" : ""}`}
              >
                My drafts
              </button>
            )}
          </div>
          <p className="forum-results-meta">{filteredInfo}</p>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      ) : null}
      {draftWarning ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {draftWarning}
        </div>
      ) : null}

      {loading ? (
        <CheckersLoader title="Loading posts..." compact className="ios-empty" />
      ) : null}

      {!loading && activePosts.length === 0 ? (
        <div className="ios-empty">
          {resolvedTab === "drafts" ? "No drafts yet." : "No threads yet."}
        </div>
      ) : null}

      <section className="forum-thread-list">
        {activePosts.map((post) => (
          <Link
            key={post.id}
            href={post.status === "DRAFT" ? `/forum/new?id=${post.id}` : `/forum/${post.id}`}
            className="forum-thread-card"
          >
            <div className="forum-thread-top">
              <div className="min-w-0">
                <p className="forum-thread-meta">
                  Thread · {formatCompactDate(post.createdAt)} · {post._count.comments} repl{post._count.comments === 1 ? "y" : "ies"} · {post.voteScore} votes
                </p>
                <h3 className="forum-thread-title">
                  {post.title}
                </h3>
                <p className="forum-thread-body">
                  {post.body}
                </p>
              </div>
              <div className="forum-thread-status">
                {post.status === "DRAFT" ? "Draft" : "Open"}
              </div>
            </div>
            <div className="forum-thread-author">
              by <span className="font-semibold text-slate-700">{post.author.displayName ?? "Member"}</span>
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
}
