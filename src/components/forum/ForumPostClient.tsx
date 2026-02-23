"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { signIn, useSession } from "next-auth/react";

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

  const fetchPost = useCallback(async () => {
    if (!postId) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/forum/posts/${postId}`);
      if (!response.ok) {
        setError("Unable to load post.");
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

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchPost();
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
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 px-6 py-10 text-sm text-slate-500">
        Loading post...
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-xs font-semibold text-slate-700"
        >
          Back
        </button>
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error || "Post not found."}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/forum"
          className="rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-xs font-semibold text-slate-700"
        >
          Back to forum
        </Link>
        <span className="text-[11px] uppercase tracking-[0.25em] text-slate-400">
          {headerMeta}
        </span>
      </div>

      <article className="surface-panel rounded-[24px] p-4">
        <h1 className="text-base font-semibold text-slate-900">{post.title}</h1>
        <p className="mt-2 text-sm text-slate-500">
          by{" "}
          <Link
            href={post.author.username ? `/u/${post.author.username}` : `/profiles/${post.author.id}`}
            className="font-semibold text-slate-700 hover:underline"
          >
            {post.author.displayName ?? "Member"}
          </Link>
        </p>
        <div className="mt-3 whitespace-pre-wrap text-sm leading-5 text-slate-700">
          {post.body}
        </div>
      </article>

      <section className="surface-panel rounded-[24px] p-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-display text-lg text-slate-900">Replies</h2>
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

        <div className="mt-4 space-y-3">
          {post.comments.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 px-6 py-8 text-sm text-slate-500">
              Be the first to reply.
            </div>
          ) : (
            commentTree.map(({ parent, replies }) => (
              <div
                key={parent.id}
                className="space-y-2 rounded-2xl border border-white/70 bg-white/70 px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-800">
                    <Link
                      href={parent.author.username ? `/u/${parent.author.username}` : `/profiles/${parent.author.id}`}
                      className="hover:underline"
                    >
                      {parent.author.displayName ?? "Member"}
                    </Link>
                  </p>
                  <p className="text-xs text-slate-400">
                    {formatLongDate(parent.createdAt)}
                  </p>
                </div>
                <p className="whitespace-pre-wrap text-sm text-slate-700">
                  {parent.body}
                </p>
                <button
                  type="button"
                  onClick={() => setReplyTo(parent)}
                  className="rounded-full border border-slate-200 bg-white/90 px-3 py-1 text-xs font-semibold text-slate-600"
                >
                  Reply
                </button>
                {replies.length > 0 && (
                  <div className="space-y-2 border-l border-slate-200 pl-3">
                    {replies.map((reply) => (
                      <div key={reply.id} className="rounded-xl bg-white px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-700">
                            <Link
                              href={reply.author.username ? `/u/${reply.author.username}` : `/profiles/${reply.author.id}`}
                              className="hover:underline"
                            >
                              {reply.author.displayName ?? "Member"}
                            </Link>
                          </p>
                          <p className="text-xs text-slate-400">
                            {formatLongDate(reply.createdAt)}
                          </p>
                        </div>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">
                          {reply.body}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div className="mt-5 grid gap-3">
          {replyTo && (
            <div className="flex items-center justify-between rounded-2xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
              <span>Replying to {replyTo.author.displayName ?? "Member"}</span>
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                className="rounded-full border border-blue-200 bg-white/80 px-2 py-1 font-semibold"
              >
                Cancel
              </button>
            </div>
          )}
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={replyTo ? "Write your threaded reply..." : "Write a reply..."}
            className="min-h-24 w-full resize-y rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-700 outline-none focus:border-[var(--royal)]"
          />
          {sendError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {sendError}
            </div>
          ) : null}
          <button
            type="button"
            onClick={handleComment}
            disabled={sending}
            className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {sending ? "Posting..." : "Reply"}
          </button>
        </div>
      </section>
    </div>
  );
}
