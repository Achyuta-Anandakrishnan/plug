"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { CheckersLoader } from "@/components/CheckersLoader";
import {
  DiscoveryBar,
  EmptyStateCard,
  PageContainer,
  PrimaryButton,
  SecondaryButton,
} from "@/components/product/ProductUI";

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
      <PageContainer className="messages-page app-page--messages app-page--snap">
        <section className="app-screen-section">
          <DiscoveryBar className="app-control-bar messages-toolbar">
            <div className="app-control-title">Messages</div>
          </DiscoveryBar>
          <EmptyStateCard
            title="Sign in to view your inbox."
            description="Your active deals and collector conversations will show up here."
            action={<PrimaryButton onClick={() => signIn()}>Sign in</PrimaryButton>}
          />
        </section>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="messages-page app-page--messages app-page--snap">
      <section className="app-screen-section app-screen-section--messages">
        <DiscoveryBar className="app-control-bar messages-toolbar">
          <div className="app-control-title">Messages</div>
          <div className="app-search">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14m0-2a9 9 0 1 0 5.65 16l4.68 4.67 1.42-1.41-4.67-4.68A9 9 0 0 0 11 2" fill="currentColor" />
            </svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search conversations"
            />
          </div>
          <div className="app-toolbar-spacer" aria-hidden="true" />
        </DiscoveryBar>

        {error ? <EmptyStateCard title="Messages unavailable" description={error} /> : null}

        <section className="messages-layout">
        {showThreadsPane ? (
          <aside className="messages-sidebar product-card">
            {loading ? (
              <CheckersLoader title="Loading conversations..." compact className="ios-empty" />
            ) : filtered.length === 0 ? (
              <EmptyStateCard title="No conversations yet." description="Messages tied to trades, streams, and support will appear here." />
            ) : (
              <div className="messages-thread-list">
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
                      className={`messages-thread-item ${selected ? "is-active" : ""}`}
                    >
                      <div className="messages-thread-item-top">
                        <p>{title || "Conversation"}</p>
                        <span>{formatTime(thread.updatedAt)}</span>
                      </div>
                      <p className="messages-thread-item-preview">{last || "No messages yet."}</p>
                    </button>
                  );
                })}
              </div>
            )}
          </aside>
        ) : null}

        {showChatPane ? (
          <section className="messages-chat product-card">
            {activeConversation ? (
              <>
                <div className="messages-chat-head">
                  <div>
                    {!isDesktop ? (
                      <button
                        type="button"
                        onClick={() => setMobilePane("threads")}
                        className="messages-back-button"
                      >
                        Back
                      </button>
                    ) : null}
                    <h2>{activeTitle}</h2>
                    <p>{activeConversation.isSupport ? "Support thread" : "Direct conversation"}</p>
                    <div className="messages-participants">
                      {activeConversation.participants
                        .filter((p) => p.userId !== sessionUserId)
                        .map((p) => (
                          <Link
                            key={p.userId}
                            href={p.user.username ? `/u/${p.user.username}` : `/profiles/${p.user.id}`}
                            className="messages-participant-pill"
                          >
                            {p.user.displayName ?? p.user.username ?? "Member"}
                          </Link>
                        ))}
                    </div>
                  </div>
                  <SecondaryButton
                    onClick={() => void handleDeleteConversation(activeConversation.id)}
                    disabled={deletingConversationId === activeConversation.id}
                  >
                    {deletingConversationId === activeConversation.id ? "Deleting..." : "Delete"}
                  </SecondaryButton>
                </div>

                <div className="messages-feed">
                  {messagesLoading ? (
                    <CheckersLoader title="Loading messages..." compact className="ios-empty" />
                  ) : messages.length === 0 ? (
                    <EmptyStateCard title="No messages yet." description="Start the conversation below." />
                  ) : (
                    <div className="messages-bubble-list">
                      {messages.map((message) => {
                        const isMe = message.senderId === sessionUserId;
                        return (
                          <div
                            key={message.id}
                            className={`messages-bubble ${isMe ? "outgoing" : "incoming"}`}
                          >
                            <p className="messages-bubble-author">
                              {isMe ? "You" : message.sender?.displayName ?? "User"}
                            </p>
                            <p className="messages-bubble-body">{message.body}</p>
                            <p className="messages-bubble-time">{formatTime(message.createdAt)}</p>
                          </div>
                        );
                      })}
                      <div ref={messageEndRef} />
                    </div>
                  )}
                </div>

                <div className="messages-compose">
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={activeId ? "Message" : "Select a conversation"}
                    disabled={!activeId || sending}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void handleSend();
                      }
                    }}
                    className="messages-compose-input"
                  />
                  <button
                    type="button"
                    onClick={() => void handleSend()}
                    disabled={!activeId || sending || !draft.trim()}
                    className="app-button app-button-primary"
                  >
                    {sending ? "Sending..." : "Send"}
                  </button>
                </div>
              </>
            ) : (
              <EmptyStateCard title="Select a conversation." description="Choose a thread on the left to start messaging." />
            )}
          </section>
        ) : null}
        </section>
      </section>
    </PageContainer>
  );
}
