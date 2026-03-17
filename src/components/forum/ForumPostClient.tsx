"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { CheckersLoader } from "@/components/CheckersLoader";
import {
  DiscoveryBar,
  EmptyStateCard,
  PageContainer,
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

type ForumComment = {
  id: string;
  body: string;
  createdAt: string;
  parentId: string | null;
  author: ForumAuthor;
};

type ForumPostDetail = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  author: ForumAuthor;
  comments: ForumComment[];
  _count: { comments: number };
  voteScore: number;
  myVote: number;
};

function formatLongDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
}

export function ForumPostClient() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const postId = params?.id ?? "";
  const { data: session } = useSession();

  const [post, setPost] = useState<ForumPostDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [comment, setComment] = useState("");
  const [replyTo, setReplyTo] = useState<ForumComment | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [voting, setVoting] = useState(false);
  const [voteError, setVoteError] = useState("");

  const fetchPost = useCallback(async () => {
    if (!postId) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/forum/posts/${postId}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        setError(payload.error || "Unable to load post.");
        setLoading(false);
        return;
      }
      const payload = (await response.json()) as ForumPostDetail;
      setPost(payload);
      setLoading(false);
    } catch {
      setError("Unable to load post.");
      setLoading(false);
    }
  }, [postId]);

  const handleVote = async (value: -1 | 1) => {
    setVoteError("");
    if (!session?.user?.id) {
      await signIn();
      return;
    }
    if (!post) return;

    const nextValue = post.myVote === value ? 0 : value;
    setVoting(true);
    try {
      const response = await fetch(`/api/forum/posts/${post.id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: nextValue }),
      });
      const payload = (await response.json()) as {
        voteScore?: number;
        myVote?: number;
        error?: string;
      };
      if (!response.ok) {
        setVoteError(payload.error || "Unable to update vote.");
        setVoting(false);
        return;
      }
      setPost((prev) => (prev
        ? {
            ...prev,
            voteScore: payload.voteScore ?? prev.voteScore,
            myVote: payload.myVote ?? prev.myVote,
          }
        : prev));
    } catch {
      setVoteError("Unable to update vote.");
    } finally {
      setVoting(false);
    }
  };

  useEffect(() => {
    void fetchPost();
  }, [fetchPost]);

  const headerMeta = useMemo(() => {
    if (!post) return "";
    return `${formatLongDate(post.createdAt)} · ${post._count.comments} repl${
      post._count.comments === 1 ? "y" : "ies"
    }`;
  }, [post]);

  const commentTree = useMemo(() => {
    if (!post) return [] as Array<{ parent: ForumComment; replies: ForumComment[] }>;

    const childrenMap = new Map<string, ForumComment[]>();
    const topLevel: ForumComment[] = [];

    for (const commentItem of post.comments) {
      if (!commentItem.parentId) {
        topLevel.push(commentItem);
        continue;
      }
      const list = childrenMap.get(commentItem.parentId) ?? [];
      list.push(commentItem);
      childrenMap.set(commentItem.parentId, list);
    }

    return topLevel.map((parent) => ({
      parent,
      replies: childrenMap.get(parent.id) ?? [],
    }));
  }, [post]);

  const handleComment = async () => {
    setSendError("");
    if (!session?.user?.id) {
      await signIn();
      return;
    }
    const text = comment.trim();
    if (text.length < 2) {
      setSendError("Comment must be at least 2 characters.");
      return;
    }
    setSending(true);
    try {
      const response = await fetch(`/api/forum/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: text,
          parentId: replyTo?.id ?? undefined,
        }),
      });
      const payload = (await response.json()) as { error?: string } & ForumComment;
      if (!response.ok) {
        setSendError(payload.error || "Unable to comment.");
        setSending(false);
        return;
      }
      setComment("");
      setReplyTo(null);
      setPost((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          comments: [...prev.comments, payload],
          _count: { comments: prev._count.comments + 1 },
        };
      });
      setSending(false);
    } catch {
      setSendError("Unable to comment.");
      setSending(false);
    }
  };

  if (loading) {
    return (
      <PageContainer className="forum-post-page app-page--forum-post">
        <CheckersLoader title="Loading thread..." compact className="ios-empty" />
      </PageContainer>
    );
  }

  if (error || !post) {
    return (
      <PageContainer className="forum-post-page app-page--forum-post">
        <section className="app-section">
          <DiscoveryBar className="app-control-bar forum-post-toolbar">
            <div className="app-control-title">Forum</div>
            <div className="app-toolbar-spacer" aria-hidden="true" />
            <SecondaryButton onClick={() => router.back()}>Back</SecondaryButton>
          </DiscoveryBar>
          <EmptyStateCard title="Thread unavailable" description={error || "Post not found."} />
        </section>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="forum-post-page app-page--forum-post">
      <section className="app-section">
        <DiscoveryBar className="app-control-bar forum-post-toolbar">
          <div className="app-control-title">Forum</div>
          <div className="forum-post-toolbar-meta">{headerMeta}</div>
          <div className="app-toolbar-spacer" aria-hidden="true" />
          <SecondaryButton href="/forum">Back to forum</SecondaryButton>
        </DiscoveryBar>

        <article className="product-card forum-post-card">
          <div className="forum-post-head">
            <p className="app-eyebrow">Thread</p>
            <h1 className="forum-post-title">{post.title}</h1>
            <div className="forum-post-author-row">
              <Link
                href={post.author.username ? `/u/${post.author.username}` : `/profiles/${post.author.id}`}
                className="forum-post-author-link"
              >
                {post.author.displayName ?? "Member"}
              </Link>
              <span>{formatLongDate(post.createdAt)}</span>
              <span>{post._count.comments} repl{post._count.comments === 1 ? "y" : "ies"}</span>
            </div>
          </div>

          <div className="forum-post-body">{post.body}</div>

          <div className="forum-post-actions">
            <SecondaryButton onClick={() => void handleVote(1)} disabled={voting}>
              {post.myVote === 1 ? "Upvoted" : "Upvote"}
            </SecondaryButton>
            <SecondaryButton onClick={() => void handleVote(-1)} disabled={voting}>
              {post.myVote === -1 ? "Downvoted" : "Downvote"}
            </SecondaryButton>
            <span className="forum-post-score">Score {post.voteScore}</span>
          </div>

          {voteError ? <div className="app-status-note is-error">{voteError}</div> : null}
        </article>

        <section className="app-section forum-post-replies">
          <SectionHeader
            title="Replies"
            subtitle={!session?.user?.id ? "Sign in to join the conversation." : "Reply inline or continue the thread below."}
            action={
              !session?.user?.id ? (
                <PrimaryButton onClick={() => signIn()}>Sign in</PrimaryButton>
              ) : null
            }
          />

          {post.comments.length === 0 ? (
            <EmptyStateCard title="No replies yet." description="Be the first to reply." />
          ) : (
            <div className="forum-comment-list">
              {commentTree.map(({ parent, replies }) => (
                <article key={parent.id} className="forum-comment-card">
                  <div className="forum-comment-head">
                    <Link
                      href={parent.author.username ? `/u/${parent.author.username}` : `/profiles/${parent.author.id}`}
                      className="forum-post-author-link"
                    >
                      {parent.author.displayName ?? "Member"}
                    </Link>
                    <span>{formatLongDate(parent.createdAt)}</span>
                  </div>
                  <p className="forum-comment-body">{parent.body}</p>
                  <div className="forum-comment-actions">
                    <SecondaryButton onClick={() => setReplyTo(parent)}>Reply</SecondaryButton>
                  </div>

                  {replies.length > 0 ? (
                    <div className="forum-comment-replies">
                      {replies.map((reply) => (
                        <div key={reply.id} className="forum-reply-card">
                          <div className="forum-comment-head">
                            <Link
                              href={reply.author.username ? `/u/${reply.author.username}` : `/profiles/${reply.author.id}`}
                              className="forum-post-author-link"
                            >
                              {reply.author.displayName ?? "Member"}
                            </Link>
                            <span>{formatLongDate(reply.createdAt)}</span>
                          </div>
                          <p className="forum-comment-body">{reply.body}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          )}

          <section className="product-card forum-reply-panel">
            {replyTo ? (
              <div className="forum-reply-context">
                <span>Replying to {replyTo.author.displayName ?? "Member"}</span>
                <SecondaryButton onClick={() => setReplyTo(null)}>Cancel</SecondaryButton>
              </div>
            ) : null}

            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={replyTo ? "Write your threaded reply..." : "Write a reply..."}
              className="forum-reply-textarea"
            />
            {sendError ? <div className="app-status-note is-error">{sendError}</div> : null}
            <div className="forum-reply-actions">
              <PrimaryButton onClick={handleComment} disabled={sending}>
                {sending ? "Posting..." : "Reply"}
              </PrimaryButton>
            </div>
          </section>
        </section>
      </section>
    </PageContainer>
  );
}
