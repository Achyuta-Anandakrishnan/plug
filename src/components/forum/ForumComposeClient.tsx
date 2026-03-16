"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { CheckersLoader } from "@/components/CheckersLoader";
import { DiscoveryBar, EmptyStateCard, PageContainer, PrimaryButton, SecondaryButton } from "@/components/product/ProductUI";

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

  if (!session?.user?.id) {
    return (
      <PageContainer className="forum-compose-page">
        <section className="app-section">
          <DiscoveryBar className="app-control-bar forum-compose-toolbar">
            <div className="app-control-title">Write thread</div>
            <SecondaryButton href="/forum">Back to forum</SecondaryButton>
          </DiscoveryBar>
          <EmptyStateCard
            title="Sign in to write a thread."
            description="Drafts autosave once you are signed in."
            action={<PrimaryButton onClick={() => signIn()}>Sign in</PrimaryButton>}
          />
        </section>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="forum-compose-page">
      <section className="app-section">
        <DiscoveryBar className="app-control-bar forum-compose-toolbar">
          <div className="app-control-title">{draftId ? "Edit thread" : "Write thread"}</div>
          <div className="forum-compose-status" aria-live="polite">
            {error ? error : statusMessage || (savingDraft ? "Autosaving..." : "Autosaves as draft")}
          </div>
          <SecondaryButton href="/forum">Back to forum</SecondaryButton>
          <PrimaryButton onClick={() => void handlePublish()} disabled={publishing}>
            {publishing ? "Publishing..." : "Publish thread"}
          </PrimaryButton>
        </DiscoveryBar>

        <section className="product-card forum-compose-panel">
          <div className="forum-compose-copy">
            <p className="app-eyebrow">{draftId ? "Draft in progress" : "New discussion"}</p>
            <h1>{draftId ? "Keep refining the thread." : "Start with a clear title and one strong point."}</h1>
            <p>Keep it concise. The draft saves automatically while you work.</p>
          </div>

          <div className="forum-compose-fields">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Thread title"
              className="forum-compose-input"
            />
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Write your thread..."
              className="forum-compose-textarea"
            />
          </div>
        </section>
      </section>
    </PageContainer>
  );
}
