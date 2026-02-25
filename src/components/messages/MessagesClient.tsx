"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn, useSession } from "next-auth/react";

type Conversation = {
  id: string;
  subject: string | null;
  isSupport: boolean;
  updatedAt: string;
  participants: Array<{
    userId: string;
    user: { id: string; username: string | null; displayName: string | null };
  }>;
  messages: Array<{
    id: string;
    body: string;
    createdAt: string;
    senderId: string;
  }>;
};

type DirectMessage = {
  id: string;
  senderId: string;
  body: string;
  createdAt: string;
  sender: { id: string; displayName: string | null };
};

function formatTime(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.valueOf())) return "";
  return d.toLocaleString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export function MessagesClient() {
  const searchParams = useSearchParams();
  const preselectConversationId = searchParams.get("c");
  const { data: session } = useSession();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/conversations");
        const payload = (await res.json()) as Conversation[];
        if (!res.ok) throw new Error((payload as unknown as { error?: string })?.error ?? "Unable to load conversations.");
        if (cancelled) return;
        setConversations(payload);
        setLoading(false);
        const initial =
          preselectConversationId ??
          payload[0]?.id ??
          null;
        setActiveId(initial);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Unable to load conversations.");
        setLoading(false);
      }
    }

    if (!session?.user?.id) {
      setLoading(false);
      setConversations([]);
      setActiveId(null);
      return;
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [preselectConversationId, session?.user?.id]);

  useEffect(() => {
    let cancelled = false;
    async function loadMessages(conversationId: string) {
      setMessagesLoading(true);
      try {
        const res = await fetch(`/api/conversations/${conversationId}/messages`);
        const payload = (await res.json()) as DirectMessage[];
        if (!res.ok) throw new Error((payload as unknown as { error?: string })?.error ?? "Unable to load messages.");
        if (cancelled) return;
        setMessages(payload);
        setMessagesLoading(false);
      } catch {
        if (cancelled) return;
        setMessages([]);
        setMessagesLoading(false);
      }
    }

    if (!activeId) {
      setMessages([]);
      return;
    }
    loadMessages(activeId);
    return () => {
      cancelled = true;
    };
  }, [activeId]);

  const filtered = useMemo(() => {
    if (!query.trim()) return conversations;
    const q = query.trim().toLowerCase();
    return conversations.filter((c) => {
      const label = c.participants
        .map((p) => p.user.displayName ?? p.user.username ?? p.userId)
        .join(" ")
        .toLowerCase();
      return label.includes(q) || (c.subject ?? "").toLowerCase().includes(q);
    });
  }, [conversations, query]);

  const sessionUserId = session?.user?.id ?? "";
  const activeConversation = conversations.find((c) => c.id === activeId) ?? null;
  const activeParticipantsLabel =
    activeConversation?.participants
      .filter((p) => p.userId !== sessionUserId)
      .map((p) => p.user.displayName ?? p.user.username ?? "Unknown")
      .join(", ") ?? "";
  const activeTitle =
    activeConversation?.subject?.trim() ||
    activeParticipantsLabel ||
    "Conversation";

  async function handleSend() {
    if (!activeId) return;
    const text = draft.trim();
    if (!text) return;
    setSending(true);
    try {
      const res = await fetch(`/api/conversations/${activeId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text }),
      });
      const payload = (await res.json()) as DirectMessage;
      if (!res.ok) {
        throw new Error((payload as unknown as { error?: string })?.error ?? "Unable to send message.");
      }
      setDraft("");
      setMessages((prev) => [...prev, payload]);
    } catch {
      // Keep silent; the API returns errors already in response body.
    } finally {
      setSending(false);
    }
  }

  if (!session?.user?.id) {
    return (
      <div className="surface-panel rounded-[28px] p-6">
        <p className="text-sm text-slate-600">Sign in to view your inbox.</p>
        <button
          onClick={() => signIn()}
          className="mt-4 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
        >
          Sign in
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl text-slate-900">Inbox</h1>
        <p className="text-sm text-slate-600">
          Direct messages between buyers, sellers, and support.
        </p>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <section className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="surface-panel rounded-[28px] p-4">
          <div className="mb-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search conversations"
              className="w-full rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-sm text-slate-700 outline-none focus:border-[var(--royal)]"
            />
          </div>

          {loading ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 px-4 py-6 text-sm text-slate-500">
              Loading conversations...
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 px-4 py-6 text-sm text-slate-500">
              No conversations yet.
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((thread) => {
                const last = thread.messages[0]?.body ?? "";
                const otherNames = thread.participants
                  .filter((p) => p.userId !== sessionUserId)
                  .map((p) => p.user.displayName ?? p.user.username ?? "Unknown")
                  .join(", ");
                const title = thread.subject ?? otherNames ?? "Conversation";
                const selected = thread.id === activeId;
                return (
                  <button
                    key={thread.id}
                    type="button"
                    onClick={() => setActiveId(thread.id)}
                    className={`w-full rounded-2xl border px-4 py-3 text-left text-sm transition ${
                      selected
                        ? "border-[var(--royal)] bg-blue-50/80"
                        : "border-white/70 bg-white/70"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-slate-900 line-clamp-1">
                        {title || "Conversation"}
                      </p>
                      <span className="text-xs text-slate-400">
                        {formatTime(thread.updatedAt)}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-1 text-slate-500">{last}</p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="surface-panel rounded-[28px] p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-display text-lg text-slate-900">
                {activeTitle}
              </p>
              <p className="text-xs text-slate-400">
                {activeConversation?.isSupport ? "Support thread" : "Direct thread"}
              </p>
              {activeConversation ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {activeConversation.participants
                    .filter((p) => p.userId !== sessionUserId)
                    .map((p) => (
                      <Link
                        key={p.userId}
                        href={p.user.username ? `/u/${p.user.username}` : `/profiles/${p.user.id}`}
                        className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 hover:text-slate-900"
                      >
                        {p.user.displayName ?? p.user.username ?? "Member"}
                      </Link>
                    ))}
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {messagesLoading ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 px-4 py-6 text-sm text-slate-500">
                Loading messages...
              </div>
            ) : messages.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 px-4 py-6 text-sm text-slate-500">
                No messages yet.
              </div>
            ) : (
              messages.map((m) => {
                const isMe = m.senderId === sessionUserId;
                return (
                  <div
                    key={m.id}
                    className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                      isMe
                        ? "ml-auto bg-[var(--royal)]/10 text-slate-800"
                        : "bg-white/70 text-slate-600"
                    }`}
                  >
                    <p className="text-xs font-semibold text-slate-500">
                      {isMe ? "You" : m.sender?.displayName ?? "User"}
                    </p>
                    <p>{m.body}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {formatTime(m.createdAt)}
                    </p>
                  </div>
                );
              })
            )}
          </div>

          <div className="mt-6 flex items-center gap-3">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={activeId ? "Type a message" : "Select a conversation"}
              disabled={!activeId || sending}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleSend();
                }
              }}
              className="flex-1 rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-sm text-slate-700 outline-none focus:border-[var(--royal)] disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={!activeId || sending || !draft.trim()}
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              Send
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
