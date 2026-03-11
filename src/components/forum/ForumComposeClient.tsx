"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { CheckersLoader } from "@/components/CheckersLoader";

type ForumComposePayload = {
  id: string;
  title: string;
  body: string;
  status: "DRAFT" | "PUBLISHED";
};

export function ForumComposeClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const draftIdFromQuery = searchParams.get("id") ?? "";

  const [draftId, setDraftId] = useState(draftIdFromQuery);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(Boolean(draftIdFromQuery));
  const [savingDraft, setSavingDraft] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  const localStorageKey = useMemo(() => {
    return `forum-compose:${session?.user?.id ?? "guest"}`;
  }, [session?.user?.id]);

  useEffect(() => {
    setDraftId(draftIdFromQuery);
  }, [draftIdFromQuery]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(localStorageKey);
      if (!raw) {
        setReady(true);
        return;
      }
      const cached = JSON.parse(raw) as { title?: string; body?: string };
      setTitle(cached.title ?? "");
      setBody(cached.body ?? "");
    } catch {
      // ignore cache parse issues
    } finally {
      setReady(true);
    }
  }, [localStorageKey]);

  useEffect(() => {
    if (!ready) return;
    window.localStorage.setItem(
      localStorageKey,
      JSON.stringify({ title, body }),
    );
  }, [body, localStorageKey, ready, title]);

  useEffect(() => {
    if (!draftIdFromQuery) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const fetchDraft = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/forum/posts/${draftIdFromQuery}`);
        const payload = (await response.json()) as { error?: string } & ForumComposePayload;
        if (!response.ok) {
          if (!cancelled) setError(payload.error || "Unable to load draft.");
          return;
        }
        if (!cancelled) {
          setTitle(payload.title);
          setBody(payload.body);
          setDraftId(payload.id);
        }
      } catch {
        if (!cancelled) setError("Unable to load draft.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void fetchDraft();
    return () => {
      cancelled = true;
    };
  }, [draftIdFromQuery]);

  const saveDraft = useCallback(async (silent = false) => {
    setError("");
    setStatusMessage("");
    if (!session?.user?.id) {
      await signIn();
      return;
    }

    const draftTitle = title.trim();
    const draftBody = body.trim();
    if (!draftTitle && !draftBody) {
      if (!silent) setError("Add a title or message before saving.");
      return;
    }

    setSavingDraft(true);
    try {
      const response = await fetch(
        draftId ? `/api/forum/posts/${draftId}` : "/api/forum/posts",
        {
          method: draftId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: draftTitle,
            body: draftBody,
            status: "draft",
          }),
        },
      );
      const payload = (await response.json()) as { error?: string } & ForumComposePayload;
      if (!response.ok) {
        setError(payload.error || "Unable to save draft.");
        return;
      }
      setDraftId(payload.id);
      if (!silent) {
        setStatusMessage("Draft saved.");
      }
    } catch {
      setError("Unable to save draft.");
    } finally {
      setSavingDraft(false);
    }
  }, [body, draftId, session?.user?.id, title]);

  const handlePublish = async () => {
    setError("");
    setStatusMessage("");
    if (!session?.user?.id) {
      await signIn();
      return;
    }

    const publishTitle = title.trim();
    const publishBody = body.trim();
    if (publishTitle.length < 3) {
      setError("Title must be at least 3 characters.");
      return;
    }
    if (publishBody.length < 10) {
      setError("Post body must be at least 10 characters.");
      return;
    }

    setPublishing(true);
    try {
      const response = await fetch(
        draftId ? `/api/forum/posts/${draftId}` : "/api/forum/posts",
        {
          method: draftId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: publishTitle,
            body: publishBody,
            status: "published",
          }),
        },
      );
      const payload = (await response.json()) as { error?: string } & ForumComposePayload;
      if (!response.ok) {
        setError(payload.error || "Unable to publish thread.");
        return;
      }
      window.localStorage.removeItem(localStorageKey);
      router.push(`/forum/${payload.id}`);
    } catch {
      setError("Unable to publish thread.");
    } finally {
      setPublishing(false);
    }
  };

  useEffect(() => {
    if (!ready || loading || !session?.user?.id) return;
    if (!title.trim() && !body.trim()) return;

    const timer = window.setTimeout(() => {
      void saveDraft(true);
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [body, loading, ready, saveDraft, session?.user?.id, title]);

  if (loading) {
    return <CheckersLoader title="Loading draft..." compact className="ios-empty" />;
  }

  return (
    <div className="ios-screen">
      <section className="ios-hero flex items-center justify-between gap-3">
        <div>
          <p className="ios-kicker">Write</p>
          <h1 className="ios-title">
            {draftId ? "Edit your thread" : "Start a thread"}
          </h1>
        </div>
        <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
          {draftId ? "Editing draft" : "New thread"}
        </span>
      </section>

      <div className="flex items-center justify-between gap-3">
        <Link
          href="/forum"
          className="rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-xs font-semibold text-slate-700"
        >
          Back to forum
        </Link>
      </div>

      <div className="ios-panel p-4">
        <p className="ios-kicker">
          Compose
        </p>
        <h2 className="ios-section-title">Write your post</h2>

        <div className="mt-3 grid gap-2">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Title"
            className="ios-input rounded-2xl"
          />
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Write your thread..."
            className="min-h-52 w-full resize-y rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm leading-5 text-slate-700 outline-none focus:border-[var(--royal)]"
          />
        </div>

        {error && (
          <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}
        {statusMessage && (
          <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {statusMessage}
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void saveDraft(false)}
            disabled={savingDraft}
            className="rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
          >
            {savingDraft ? "Saving..." : "Save Draft"}
          </button>
          <button
            type="button"
            onClick={() => void handlePublish()}
            disabled={publishing}
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {publishing ? "Publishing..." : "Publish"}
          </button>
        </div>
      </div>
    </div>
  );
}
