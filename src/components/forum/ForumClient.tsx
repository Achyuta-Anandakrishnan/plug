"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { CheckersLoader } from "@/components/CheckersLoader";
import {
  DiscoveryBar,
  EmptyStateCard,
  FilterChip,
  PageContainer,
  PrimaryButton,
  SearchIcon,
  SecondaryButton,
} from "@/components/product/ProductUI";
import { useMobileUi } from "@/hooks/useMobileUi";

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
  const isMobileUi = useMobileUi();
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
    const timeout = window.setTimeout(() => {
      void fetchPosts(query);
    }, 0);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [fetchPosts, query]);

  const resolvedTab = session?.user?.id ? activeTab : "published";
  const activePosts = resolvedTab === "drafts" ? draftPosts : publishedPosts;

  const handleSearch = async () => {
    await fetchPosts(query);
  };

  return (
    <PageContainer className="forum-page app-page--forum">
      <section className="app-section">
        {isMobileUi ? (
          <section className="mobile-page-toolbar forum-mobile-toolbar" aria-label="Forum browsing controls">
            <div className="mobile-page-toolbar-top">
              <div className="app-control-title">Forum</div>
              {session?.user?.id ? (
                <PrimaryButton href="/forum/new" className="forum-mobile-compose">Write</PrimaryButton>
              ) : (
                <SecondaryButton onClick={() => signIn()} className="forum-mobile-compose">Sign in</SecondaryButton>
              )}
            </div>
            <div className="app-search">
              <SearchIcon />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search threads"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void handleSearch();
                  }
                }}
              />
            </div>
            <div className="app-chip-row mobile-page-toolbar-scroll">
              <FilterChip
                label="Published"
                active={resolvedTab === "published"}
                onClick={() => setActiveTab("published")}
              />
              {session?.user?.id ? (
                <FilterChip
                  label="My drafts"
                  active={resolvedTab === "drafts"}
                  onClick={() => setActiveTab("drafts")}
                />
              ) : null}
            </div>
          </section>
        ) : (
          <DiscoveryBar className="app-control-bar forum-toolbar">
            <div className="app-control-title">Forum</div>
            <div className="app-search">
              <SearchIcon />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search threads"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void handleSearch();
                  }
                }}
              />
            </div>
            <div className="app-chip-row">
              <FilterChip
                label="Published"
                active={resolvedTab === "published"}
                onClick={() => setActiveTab("published")}
              />
              {session?.user?.id ? (
                <FilterChip
                  label="My drafts"
                  active={resolvedTab === "drafts"}
                  onClick={() => setActiveTab("drafts")}
                />
              ) : null}
            </div>
            <div className="app-toolbar-spacer" aria-hidden="true" />
            <button type="button" onClick={() => void handleSearch()} className="app-button app-button-primary forum-toolbar-search">
              Search
            </button>
            {!session?.user?.id ? (
              <SecondaryButton onClick={() => signIn()} className="forum-toolbar-auth">Sign in</SecondaryButton>
            ) : null}
            <PrimaryButton href="/forum/new" className="forum-toolbar-compose">Write thread</PrimaryButton>
          </DiscoveryBar>
        )}

        {error ? <EmptyStateCard title="Forum unavailable" description={error} /> : null}
        {draftWarning ? <EmptyStateCard title="Drafts unavailable" description={draftWarning} /> : null}
        {loading ? <CheckersLoader title="Loading posts..." compact className="ios-empty" /> : null}

        <section className="app-section">
          {!loading && activePosts.length === 0 ? (
            <EmptyStateCard
              title={resolvedTab === "drafts" ? "No drafts yet." : "No threads yet."}
              description={resolvedTab === "drafts" ? "Saved forum drafts will show up here." : "Be the first collector to start a discussion."}
            />
          ) : null}

          <section className="forum-thread-list">
            {activePosts.map((post) => (
              <Link
                key={post.id}
                href={post.status === "DRAFT" ? `/forum/new?id=${post.id}` : `/forum/${post.id}`}
                className="forum-thread-card"
              >
                <div className="forum-thread-top">
                  <div className="forum-thread-main">
                    <div className="forum-thread-meta">
                      <span>{post.status === "DRAFT" ? "Draft" : "Thread"}</span>
                      <span>{formatCompactDate(post.updatedAt)}</span>
                      <span>{post._count.comments} repl{post._count.comments === 1 ? "y" : "ies"}</span>
                      <span>{post.voteScore} votes</span>
                      <span>{post.author.displayName ?? "Member"}</span>
                    </div>
                    <h3 className="forum-thread-title">{post.title}</h3>
                    <p className="forum-thread-body">{post.body}</p>
                  </div>
                  <span className="forum-thread-action">
                    {post.status === "DRAFT" ? "Edit draft" : "Open"}
                  </span>
                </div>
              </Link>
            ))}
          </section>
        </section>
      </section>
    </PageContainer>
  );
}
