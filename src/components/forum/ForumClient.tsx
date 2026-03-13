"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { CheckersLoader } from "@/components/CheckersLoader";
import {
  DiscoveryBar,
  EmptyStateCard,
  FilterChip,
  PageContainer,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  SectionHeader,
} from "@/components/product/ProductUI";

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
    if (!query.trim()) return "Latest threads";
    return `Results for "${query.trim()}"`;
  }, [query]);

  const resolvedTab = session?.user?.id ? activeTab : "published";
  const activePosts = resolvedTab === "drafts" ? draftPosts : publishedPosts;

  const handleSearch = async () => {
    await fetchPosts(query);
  };

  return (
    <PageContainer className="forum-page app-page--forum app-page--snap">
      <section className="app-screen-section">
        <PageHeader
          title="Forum"
          subtitle="Collector discussion, market talk, and hobby knowledge in one board."
          actions={(
            <>
              {session?.user?.id ? (
                <SecondaryButton href="/forum/new">Draft</SecondaryButton>
              ) : (
                <SecondaryButton onClick={() => signIn()}>Sign in</SecondaryButton>
              )}
              <PrimaryButton href="/forum/new">Post thread</PrimaryButton>
            </>
          )}
        />

        <DiscoveryBar className="forum-toolbar">
          <div className="app-search">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14m0-2a9 9 0 1 0 5.65 16l4.68 4.67 1.42-1.41-4.67-4.68A9 9 0 0 0 11 2" fill="currentColor" />
            </svg>
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

          <div className="app-toolbar-row forum-toolbar-row">
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

            <div className="app-toolbar-tools">
              <button type="button" onClick={() => void handleSearch()} className="app-button app-button-primary">
                Search
              </button>
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  void fetchPosts("");
                }}
                className="app-button app-button-secondary"
              >
                Clear
              </button>
            </div>
          </div>

          <p className="forum-results-meta">{filteredInfo}</p>
        </DiscoveryBar>

        {error ? <EmptyStateCard title="Forum unavailable" description={error} /> : null}
        {draftWarning ? <EmptyStateCard title="Drafts unavailable" description={draftWarning} /> : null}
      </section>

      <section className="app-screen-section">
        {loading ? <CheckersLoader title="Loading posts..." compact className="ios-empty" /> : null}

        <section className="app-section">
          <SectionHeader title="Threads" subtitle="Browse active topics, replies, and recent discussion." />

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
                className="forum-thread-card product-card"
              >
                <div className="forum-thread-top">
                  <div className="forum-thread-main">
                    <div className="forum-thread-meta">
                      <span>{post.status === "DRAFT" ? "Draft" : "Thread"}</span>
                      <span>{formatCompactDate(post.updatedAt)}</span>
                      <span>{post._count.comments} repl{post._count.comments === 1 ? "y" : "ies"}</span>
                      <span>{post.voteScore} votes</span>
                    </div>
                    <h3 className="forum-thread-title">{post.title}</h3>
                    <p className="forum-thread-body">{post.body}</p>
                  </div>
                  <div className="forum-thread-status">
                    {post.status === "DRAFT" ? "Draft" : "Open"}
                  </div>
                </div>
                <div className="forum-thread-author">
                  <span>{post.author.displayName ?? "Member"}</span>
                  <span>Last active {formatCompactDate(post.updatedAt)}</span>
                </div>
              </Link>
            ))}
          </section>
        </section>
      </section>
    </PageContainer>
  );
}
