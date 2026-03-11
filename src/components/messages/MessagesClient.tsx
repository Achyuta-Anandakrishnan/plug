"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
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
  const [deletingConversationId, setDeletingConversationId] = useState<string | null>(null);

  const [isDesktop, setIsDesktop] = useState(false);
  const [mobilePane, setMobilePane] = useState<"threads" | "chat">(
    preselectConversationId ? "chat" : "threads",
  );

  const messageEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(min-width: 1024px)");
    const onChange = () => setIsDesktop(media.matches);
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (preselectConversationId) {
      setMobilePane("chat");
    }
  }, [preselectConversationId]);

  useEffect(() => {
    if (!messageEndRef.current || messagesLoading) return;
    messageEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, activeId, messagesLoading]);

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
        const initial = preselectConversationId ?? payload[0]?.id ?? null;
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

    void load();
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
      if (!isDesktop) setMobilePane("threads");
      return;
    }

    void loadMessages(activeId);
    return () => {
      cancelled = true;
    };
  }, [activeId, isDesktop]);

  useEffect(() => {
    if (!activeId) return;
    if (conversations.some((thread) => thread.id === activeId)) return;
    setActiveId(conversations[0]?.id ?? null);
    setMessages([]);
    setDraft("");
  }, [activeId, conversations]);

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

  const showThreadsPane = isDesktop || mobilePane === "threads";
  const showChatPane = isDesktop || mobilePane === "chat";

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
      // Keep silent; API handles detailed error cases.
    } finally {
      setSending(false);
    }
  }

  async function handleDeleteConversation(conversationId: string) {
    if (!conversationId) return;
    const confirmed = window.confirm(
      "Delete this chat? This will remove all messages in this conversation.",
    );
    if (!confirmed) return;

    setDeletingConversationId(conversationId);
    setError("");
    try {
      const res = await fetch(`/api/conversations/${conversationId}`, {
        method: "DELETE",
      });
      const payload = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(payload.error ?? "Unable to delete chat.");
      }
      setConversations((prev) => prev.filter((thread) => thread.id !== conversationId));
      if (activeId === conversationId) {
        setActiveId(null);
        setMessages([]);
        setDraft("");
        if (!isDesktop) setMobilePane("threads");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to delete chat.");
    } finally {
      setDeletingConversationId(null);
    }
  }

  if (!session?.user?.id) {
    return (
      <div className="ios-panel p-6">
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
    <div className="ios-screen">
      <section className="ios-hero space-y-2">
        <h1 className="ios-title">Messages</h1>
      </section>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <section className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        {showThreadsPane ? (
          <div className="ios-panel p-4 lg:max-h-[76vh] lg:overflow-hidden">
            <div className="mb-3">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search conversations"
                className="ios-input text-sm"
              />
            </div>

            {loading ? (
              <div className="ios-empty">Loading conversations...</div>
            ) : filtered.length === 0 ? (
              <div className="ios-empty">No conversations yet.</div>
            ) : (
              <div className="space-y-2.5 max-h-[calc(100dvh-19rem)] overflow-y-auto pr-1 lg:max-h-[64vh]">
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
                      onClick={() => {
                        setActiveId(thread.id);
                        if (!isDesktop) setMobilePane("chat");
                      }}
                      className={`w-full rounded-2xl border px-3.5 py-3 text-left transition ${
                        selected
                          ? "border-slate-400 bg-white"
                          : "border-white/70 bg-white/75"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="line-clamp-1 text-sm font-semibold text-slate-900">{title || "Conversation"}</p>
                        <span className="text-[11px] text-slate-400">{formatTime(thread.updatedAt)}</span>
                      </div>
                      <p className="mt-1 line-clamp-1 text-xs text-slate-500">{last}</p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}

        {showChatPane ? (
          <div className="ios-panel flex min-h-[calc(100dvh-14.5rem)] flex-col p-4 sm:p-5 lg:min-h-[76vh] lg:p-6">
            {activeConversation ? (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="mb-2 flex items-center gap-2 lg:hidden">
                      <button
                        type="button"
                        onClick={() => setMobilePane("threads")}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700"
                      >
                        Back
                      </button>
                    </div>
                    <p className="truncate font-display text-2xl text-slate-900">{activeTitle}</p>
                    <p className="text-[11px] text-slate-400">
                      {activeConversation.isSupport ? "Support" : "Direct"}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {activeConversation.participants
                        .filter((p) => p.userId !== sessionUserId)
                        .map((p) => (
                          <Link
                            key={p.userId}
                            href={p.user.username ? `/u/${p.user.username}` : `/profiles/${p.user.id}`}
                            className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600 hover:text-slate-900"
                          >
                            {p.user.displayName ?? p.user.username ?? "Member"}
                          </Link>
                        ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleDeleteConversation(activeConversation.id)}
                    disabled={deletingConversationId === activeConversation.id}
                    className="rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-[11px] font-semibold text-red-700 disabled:opacity-60"
                  >
                    {deletingConversationId === activeConversation.id ? "Deleting..." : "Delete"}
                  </button>
                </div>

                <div className="mt-4 flex-1 min-h-0 overflow-y-auto rounded-2xl border border-slate-200/80 bg-white/65 p-3.5 sm:p-4 scroll-smooth">
                  {messagesLoading ? (
                    <div className="ios-empty">Loading messages...</div>
                  ) : messages.length === 0 ? (
                    <div className="ios-empty">No messages yet.</div>
                  ) : (
                    <div className="space-y-2.5">
                      {messages.map((m) => {
                        const isMe = m.senderId === sessionUserId;
                        return (
                          <div
                            key={m.id}
                            className={`max-w-[76%] rounded-[18px] px-3.5 py-2 text-[13px] leading-5 shadow-sm ${
                              isMe
                                ? "ml-auto bg-slate-900 text-white"
                                : "bg-slate-100 text-slate-900"
                            }`}
                          >
                            <p className={`text-[10px] font-semibold ${isMe ? "text-white/70" : "text-slate-500"}`}>
                              {isMe ? "You" : m.sender?.displayName ?? "User"}
                            </p>
                            <p className="mt-0.5 whitespace-pre-wrap break-words">{m.body}</p>
                            <p className={`mt-1 text-[10px] ${isMe ? "text-white/65" : "text-slate-400"}`}>
                              {formatTime(m.createdAt)}
                            </p>
                          </div>
                        );
                      })}
                      <div ref={messageEndRef} />
                    </div>
                  )}
                </div>

                <div className="mt-3 flex items-center gap-2.5">
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={activeId ? "iMessage" : "Select a conversation"}
                    disabled={!activeId || sending}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void handleSend();
                      }
                    }}
                    className="ios-input h-10 flex-1 rounded-2xl px-3 text-sm disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={() => void handleSend()}
                    disabled={!activeId || sending || !draft.trim()}
                    className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    Send
                  </button>
                </div>
              </>
            ) : (
              <div className="ios-empty flex-1">
                Select a conversation.
              </div>
            )}
          </div>
        ) : null}
      </section>
    </div>
  );
}
