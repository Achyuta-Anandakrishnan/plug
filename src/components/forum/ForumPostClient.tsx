"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { signIn, useSession } from "next-auth/react";

type ForumAuthor = {
  id: string;
  displayName: string | null;
  image: string | null;
};

type ForumComment = {
  id: string;
  body: string;
  createdAt: string;
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
        body: JSON.stringify({ body: text }),
      });
      const payload = (await response.json()) as { error?: string } & ForumComment;
      if (!response.ok) {
        setSendError(payload.error || "Unable to comment.");
        setSending(false);
        return;
      }
      setComment("");
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

      <article className="surface-panel rounded-[28px] p-6">
        <h1 className="font-display text-3xl text-slate-900">{post.title}</h1>
        <p className="mt-2 text-sm text-slate-500">
          by {post.author.displayName ?? "Member"}
        </p>
        <div className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-700">
          {post.body}
        </div>
      </article>

      <section className="surface-panel rounded-[28px] p-6">
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
            post.comments.map((c) => (
              <div
                key={c.id}
                className="rounded-2xl border border-white/70 bg-white/70 px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-800">
                    {c.author.displayName ?? "Member"}
                  </p>
                  <p className="text-xs text-slate-400">
                    {formatLongDate(c.createdAt)}
                  </p>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                  {c.body}
                </p>
              </div>
            ))
          )}
        </div>

        <div className="mt-5 grid gap-3">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Write a reply..."
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

