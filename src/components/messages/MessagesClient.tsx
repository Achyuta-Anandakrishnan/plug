"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { CheckersLoader } from "@/components/CheckersLoader";
import {
  DiscoveryBar,
  EmptyStateCard,
  PageContainer,
  PrimaryButton,
  SearchIcon,
  SecondaryButton,
} from "@/components/product/ProductUI";
import { useMobileUi } from "@/hooks/useMobileUi";

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

type ConversationListResponse = {
  items: Conversation[];
};

type MessageListResponse = {
  items: DirectMessage[];
  nextCursor: string | null;
};

function formatTime(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.valueOf())) return "";
  return d.toLocaleString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function getInitials(value: string) {
  const parts = value
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) return "?";
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

type MessagesClientProps = {
  initialIsMobile?: boolean;
};

export function MessagesClient({ initialIsMobile }: MessagesClientProps) {
  const searchParams = useSearchParams();
  const preselectConversationId = searchParams.get("c");
  const { data: session } = useSession();
  const isMobileUi = useMobileUi(initialIsMobile);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [messagesCursor, setMessagesCursor] = useState<string | null>(null);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [deletingConversationId, setDeletingConversationId] = useState<string | null>(null);
  const [mobilePane, setMobilePane] = useState<"threads" | "chat">(
    preselectConversationId ? "chat" : "threads",
  );

  const messageEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (preselectConversationId) {
      setMobilePane("chat");
    }
  }, [preselectConversationId]);

  useEffect(() => {
    if (!messageEndRef.current || messagesLoading || loadingOlder) return;
    messageEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, activeId, loadingOlder, messagesLoading]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams();
        params.set("limit", "40");
        if (query.trim()) params.set("q", query.trim());
        const res = await fetch(`/api/conversations?${params.toString()}`);
        const payload = (await res.json()) as ConversationListResponse & { error?: string };
        if (!res.ok) throw new Error(payload.error ?? "Unable to load conversations.");
        if (cancelled) return;
        setConversations(payload.items);
        setLoading(false);
        setActiveId((current) => {
          if (preselectConversationId) return preselectConversationId;
          if (current && payload.items.some((entry) => entry.id === current)) return current;
          return payload.items[0]?.id ?? null;
        });
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

    const timeout = window.setTimeout(() => {
      void load();
    }, query.trim() ? 200 : 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [preselectConversationId, query, session?.user?.id]);

  useEffect(() => {
    let cancelled = false;

    async function loadMessages(conversationId: string) {
      setMessagesLoading(true);
      try {
        const params = new URLSearchParams({ limit: "40" });
        const res = await fetch(`/api/conversations/${conversationId}/messages?${params.toString()}`);
        const payload = (await res.json()) as MessageListResponse & { error?: string };
        if (!res.ok) throw new Error(payload.error ?? "Unable to load messages.");
        if (cancelled) return;
        setMessages(payload.items);
        setMessagesCursor(payload.nextCursor);
        setMessagesLoading(false);
      } catch {
        if (cancelled) return;
        setMessages([]);
        setMessagesCursor(null);
        setMessagesLoading(false);
      }
    }

    if (!activeId) {
      setMessages([]);
      setMessagesCursor(null);
      if (isMobileUi) setMobilePane("threads");
      return;
    }

    void loadMessages(activeId);
    return () => {
      cancelled = true;
    };
  }, [activeId, isMobileUi]);

  useEffect(() => {
    if (!activeId) return;
    if (conversations.some((thread) => thread.id === activeId)) return;
    setActiveId(conversations[0]?.id ?? null);
    setMessages([]);
    setMessagesCursor(null);
    setDraft("");
  }, [activeId, conversations]);

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

  const isDesktop = !isMobileUi;
  const showThreadsPane = isDesktop || mobilePane === "threads";
  const showChatPane = isDesktop || mobilePane === "chat";

  async function loadOlderMessages() {
    if (!activeId || !messagesCursor || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const params = new URLSearchParams({
        limit: "40",
        before: messagesCursor,
      });
      const res = await fetch(`/api/conversations/${activeId}/messages?${params.toString()}`);
      const payload = (await res.json()) as MessageListResponse & { error?: string };
      if (!res.ok) {
        throw new Error(payload.error ?? "Unable to load older messages.");
      }
      setMessages((prev) => [...payload.items, ...prev]);
      setMessagesCursor(payload.nextCursor);
    } catch {
      // Keep existing messages visible on pagination errors.
    } finally {
      setLoadingOlder(false);
    }
  }

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
      setConversations((prev) =>
        prev.map((thread) =>
          thread.id === activeId
            ? {
                ...thread,
                updatedAt: payload.createdAt,
                messages: [
                  {
                    id: payload.id,
                    body: payload.body,
                    createdAt: payload.createdAt,
                    senderId: payload.senderId,
                  },
                ],
              }
            : thread,
        ),
      );
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
        if (isMobileUi) setMobilePane("threads");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to delete chat.");
    } finally {
      setDeletingConversationId(null);
    }
  }

  if (!session?.user?.id) {
    return (
      <PageContainer className="messages-page app-page--messages">
        <section className="app-section">
          {isDesktop ? (
            <DiscoveryBar className="app-control-bar messages-toolbar">
              <div className="app-control-title">Messages</div>
            </DiscoveryBar>
          ) : (
            <section className="mobile-page-toolbar messages-mobile-toolbar">
              <div className="mobile-page-toolbar-top">
                <div className="app-control-title">Messages</div>
              </div>
            </section>
          )}
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
    <PageContainer className="messages-page app-page--messages">
      <section className="app-section app-screen-section--messages">
        {isDesktop || mobilePane === "threads" ? (
          isDesktop ? (
            <DiscoveryBar className="app-control-bar messages-toolbar">
              <div className="app-control-title">Messages</div>
              <div className="app-search">
                <SearchIcon />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search conversations"
                />
              </div>
              <div className="app-toolbar-spacer" aria-hidden="true" />
            </DiscoveryBar>
          ) : (
            <section className="mobile-page-toolbar messages-mobile-toolbar">
              <div className="mobile-page-toolbar-top">
                <div className="app-control-title">Messages</div>
              </div>
              <div className="app-search">
                <SearchIcon />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search conversations"
                />
              </div>
            </section>
          )
        ) : null}

        {error ? <EmptyStateCard title="Messages unavailable" description={error} /> : null}

        <section className="messages-layout">
        {showThreadsPane ? (
          <aside className="messages-sidebar messages-panel">
            {loading ? (
              <CheckersLoader title="Loading conversations..." compact />
            ) : conversations.length === 0 ? (
              <EmptyStateCard
                title="No conversations yet."
                description="Messages tied to trades, streams, and support will appear here."
                className="messages-empty-state"
              />
            ) : (
              <div className="messages-thread-list">
                {conversations.map((thread) => {
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
                      <div className="messages-thread-item-avatar" aria-hidden="true">
                        {getInitials(title || "Conversation")}
                      </div>
                      <div className="messages-thread-item-copy">
                        <div className="messages-thread-item-top">
                          <p>{title || "Conversation"}</p>
                          <span>{formatTime(thread.updatedAt)}</span>
                        </div>
                        <p className="messages-thread-item-preview">{last || "No messages yet."}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </aside>
        ) : null}

        {showChatPane ? (
          <section className={`messages-chat messages-panel ${!isDesktop ? "is-mobile-pane" : ""}`}>
            {activeConversation ? (
              <>
                <div className="messages-chat-head">
                  <div className="messages-chat-head-copy">
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
                    <p className="messages-chat-sublabel">
                      {activeConversation.isSupport ? "Support thread" : activeParticipantsLabel || "Direct conversation"}
                    </p>
                  </div>
                  <div className="messages-chat-head-actions">
                    <SecondaryButton
                      onClick={() => void handleDeleteConversation(activeConversation.id)}
                      disabled={deletingConversationId === activeConversation.id}
                      className="messages-delete-button"
                    >
                      {deletingConversationId === activeConversation.id ? "Deleting..." : "Delete"}
                    </SecondaryButton>
                  </div>
                </div>

                <div className="messages-feed">
                  {messagesLoading ? (
                    <CheckersLoader title="Loading messages..." compact />
                  ) : messages.length === 0 ? (
                    <EmptyStateCard
                      title="No messages yet."
                      description="Start the conversation below."
                      className="messages-empty-state"
                    />
                  ) : (
                    <div className="messages-feed-inner">
                    <div className="messages-bubble-list">
                      {messagesCursor ? (
                        <button
                          type="button"
                          onClick={() => void loadOlderMessages()}
                          disabled={loadingOlder}
                          className="messages-load-more"
                        >
                          {loadingOlder ? "Loading earlier..." : "Load earlier messages"}
                        </button>
                      ) : null}
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
