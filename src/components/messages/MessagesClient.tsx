"use client";

import Image from "next/image";
import Link from "next/link";
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
    imageUrl?: string | null;
    createdAt: string;
    senderId: string;
  }>;
};

type DirectMessage = {
  id: string;
  senderId: string;
  body: string;
  imageUrl?: string | null;
  createdAt: string;
  sender: { id: string; displayName: string | null };
};

type ConversationListResponse = {
  items: Conversation[];
  profiles?: ProfileSearchResult[];
};

type MessageListResponse = {
  items: DirectMessage[];
  nextCursor: string | null;
};

type ProfileSearchResult = {
  id: string;
  username: string | null;
  displayName: string | null;
  bio: string | null;
  image: string | null;
  role: string;
  sellerProfile: {
    status: string | null;
    trustTier: string | null;
    auctions: Array<{ id: string }>;
  } | null;
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
  const [profileResults, setProfileResults] = useState<ProfileSearchResult[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [startingConversationId, setStartingConversationId] = useState<string | null>(null);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [messagesCursor, setMessagesCursor] = useState<string | null>(null);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [attachedImageUrl, setAttachedImageUrl] = useState<string | null>(null);
  const [attachedImageName, setAttachedImageName] = useState("");
  const [deletingConversationId, setDeletingConversationId] = useState<string | null>(null);
  const [mobilePane, setMobilePane] = useState<"threads" | "chat">(
    preselectConversationId ? "chat" : "threads",
  );

  const messageEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const sessionUserId = session?.user?.id ?? "";

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
      setProfilesLoading(Boolean(query.trim()));
      try {
        const params = new URLSearchParams();
        params.set("limit", "40");
        if (query.trim()) params.set("q", query.trim());
        const res = await fetch(`/api/conversations?${params.toString()}`);
        const payload = (await res.json()) as ConversationListResponse & { error?: string };
        if (!res.ok) throw new Error(payload.error ?? "Unable to load conversations.");
        if (cancelled) return;
        setConversations(payload.items);
        setProfileResults((payload.profiles ?? []).filter((entry) => entry.id !== sessionUserId));
        setLoading(false);
        setProfilesLoading(false);
        setActiveId((current) => {
          if (preselectConversationId) return preselectConversationId;
          if (current && payload.items.some((entry) => entry.id === current)) return current;
          return payload.items[0]?.id ?? null;
        });
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Unable to load conversations.");
        setProfileResults([]);
        setProfilesLoading(false);
        setLoading(false);
      }
    }

    if (!session?.user?.id) {
      setLoading(false);
      setConversations([]);
      setActiveId(null);
      setProfileResults([]);
      setProfilesLoading(false);
      return;
    }

    const timeout = window.setTimeout(() => {
      void load();
    }, query.trim() ? 200 : 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [preselectConversationId, query, session?.user?.id, sessionUserId]);

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
    setAttachedImageUrl(null);
    setAttachedImageName("");
  }, [activeId, conversations]);

  const activeConversation = conversations.find((c) => c.id === activeId) ?? null;
  const activeParticipants =
    activeConversation?.participants.filter((p) => p.userId !== sessionUserId) ?? [];
  const activeParticipantsLabel =
    activeParticipants.map((p) => p.user.displayName ?? p.user.username ?? "Unknown").join(", ");
  const activeTitle =
    activeConversation?.subject?.trim() ||
    activeParticipantsLabel ||
    "Conversation";
  const activeParticipantHref = (() => {
    if (!activeConversation || activeConversation.isSupport || activeParticipants.length !== 1) return null;
    const u = activeParticipants[0].user;
    return u.username ? `/u/${encodeURIComponent(u.username)}` : `/profiles/${u.id}`;
  })();

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
    if (!text && !attachedImageUrl) return;
    setSending(true);
    try {
      const res = await fetch(`/api/conversations/${activeId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text, imageUrl: attachedImageUrl }),
      });
      const payload = (await res.json()) as DirectMessage;
      if (!res.ok) {
        throw new Error((payload as unknown as { error?: string })?.error ?? "Unable to send message.");
      }
      setDraft("");
      setAttachedImageUrl(null);
      setAttachedImageName("");
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
                    imageUrl: payload.imageUrl ?? null,
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

  async function handlePhotoSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingPhoto(true);
    setError("");
    try {
      const formData = new FormData();
      formData.set("file", file);
      const res = await fetch("/api/uploads?scope=messages", {
        method: "POST",
        body: formData,
      });
      const payload = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !payload.url) {
        throw new Error(payload.error ?? "Unable to upload photo.");
      }
      setAttachedImageUrl(payload.url);
      setAttachedImageName(file.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to upload photo.");
      setAttachedImageUrl(null);
      setAttachedImageName("");
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  function getConversationPreview(thread: Conversation) {
    const lastMessage = thread.messages[0];
    if (!lastMessage) return "No messages yet.";
    if (lastMessage.body?.trim()) return lastMessage.body;
    if (lastMessage.imageUrl) return "Sent a photo";
    return "No messages yet.";
  }

  function getProfileHref(profile: ProfileSearchResult) {
    return profile.username ? `/u/${encodeURIComponent(profile.username)}` : `/profiles/${profile.id}`;
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

  async function handleStartConversation(targetUserId: string) {
    if (!sessionUserId || !targetUserId || startingConversationId === targetUserId) return;

    const existingDirect = conversations.find((thread) => {
      if (thread.subject || thread.isSupport || thread.participants.length !== 2) return false;
      const ids = thread.participants.map((participant) => participant.userId);
      return ids.includes(sessionUserId) && ids.includes(targetUserId);
    });

    if (existingDirect) {
      setActiveId(existingDirect.id);
      setProfileResults([]);
      if (!isDesktop) setMobilePane("chat");
      return;
    }

    setStartingConversationId(targetUserId);
    setError("");
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantIds: [sessionUserId, targetUserId],
        }),
      });
      const payload = (await res.json()) as Conversation & { error?: string };
      if (!res.ok) {
        throw new Error(payload.error ?? "Unable to start conversation.");
      }

      setConversations((prev) => {
        const withoutExisting = prev.filter((thread) => thread.id !== payload.id);
        return [
          {
            ...payload,
            messages: payload.messages ?? [],
          },
          ...withoutExisting,
        ];
      });
      setActiveId(payload.id);
      setMessages([]);
      setMessagesCursor(null);
      setDraft("");
      setAttachedImageUrl(null);
      setAttachedImageName("");
      setProfileResults([]);
      if (!isDesktop) setMobilePane("chat");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to start conversation.");
    } finally {
      setStartingConversationId(null);
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
                  placeholder="Search conversations or profiles"
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
                  placeholder="Search conversations or profiles"
                />
              </div>
            </section>
          )
        ) : null}

        {error ? <EmptyStateCard title="Messages unavailable" description={error} /> : null}

        <section className="messages-layout">
        {showThreadsPane ? (
          <aside className="messages-sidebar messages-panel">
            {query.trim() ? (
              <div className="messages-profile-search">
                <div className="messages-profile-search-head">
                  <strong>Profiles</strong>
                  <span>Open their profile or start a chat</span>
                </div>
                <div className="messages-profile-results">
                  {profilesLoading ? (
                    <p className="messages-profile-search-status">Searching collectors...</p>
                  ) : profileResults.length === 0 ? (
                    <p className="messages-profile-search-status">No matching collectors.</p>
                  ) : (
                    profileResults.map((profile) => {
                      const profileName = profile.displayName ?? profile.username ?? "Collector";
                      const profileMeta = profile.username ? `@${profile.username}` : "Collector profile";
                      const isStarting = startingConversationId === profile.id;

                      return (
                        <div key={profile.id} className="messages-profile-result">
                          <div className="messages-thread-item-avatar" aria-hidden="true">
                            {getInitials(profileName)}
                          </div>
                          <div className="messages-profile-result-copy">
                            <Link href={getProfileHref(profile)} className="messages-profile-result-link">
                              {profileName}
                            </Link>
                            <span>{profileMeta}</span>
                            {profile.bio ? (
                              <span className="messages-profile-result-bio">{profile.bio}</span>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            onClick={() => void handleStartConversation(profile.id)}
                            className="messages-profile-result-action"
                            disabled={isStarting}
                          >
                            {isStarting ? "Opening..." : "Message"}
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ) : null}

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
                  const otherNames = thread.participants
                    .filter((p) => p.userId !== sessionUserId)
                    .map((p) => p.user.displayName ?? p.user.username ?? "Unknown")
                    .join(", ");
                  const title = thread.subject ?? otherNames ?? "Conversation";
                  const selected = thread.id === activeId;
                  const preview = getConversationPreview(thread);

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
                        <p className="messages-thread-item-preview">{preview}</p>
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
                    {activeParticipantHref ? (
                      <h2><Link href={activeParticipantHref} className="messages-chat-profile-link">{activeTitle}</Link></h2>
                    ) : (
                      <h2>{activeTitle}</h2>
                    )}
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
                            {message.imageUrl ? (
                              <a href={message.imageUrl} target="_blank" rel="noreferrer" className="messages-bubble-image-link">
                                <Image
                                  src={message.imageUrl}
                                  alt="Shared in chat"
                                  width={320}
                                  height={320}
                                  unoptimized
                                  className="messages-bubble-image"
                                />
                              </a>
                            ) : null}
                            {message.body ? <p className="messages-bubble-body">{message.body}</p> : null}
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
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(event) => void handlePhotoSelected(event)}
                    className="messages-compose-file"
                  />
                  {attachedImageUrl ? (
                    <div className="messages-compose-attachment">
                      <div className="messages-compose-attachment-preview">
                        <Image
                          src={attachedImageUrl}
                          alt="Ready to send"
                          width={44}
                          height={44}
                          unoptimized
                          className="messages-compose-attachment-image"
                        />
                        <div className="messages-compose-attachment-copy">
                          <strong>{attachedImageName || "Photo attached"}</strong>
                          <span>Will send with your next message</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setAttachedImageUrl(null);
                          setAttachedImageName("");
                        }}
                        className="messages-compose-attachment-remove"
                      >
                        Remove
                      </button>
                    </div>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={!activeId || sending || uploadingPhoto}
                    className="app-button app-button-secondary messages-compose-photo"
                  >
                    {uploadingPhoto ? "Uploading..." : "Photo"}
                  </button>
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={activeId ? "Message" : "Select a conversation"}
                    disabled={!activeId || sending || uploadingPhoto}
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
                    disabled={!activeId || sending || uploadingPhoto || (!draft.trim() && !attachedImageUrl)}
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
