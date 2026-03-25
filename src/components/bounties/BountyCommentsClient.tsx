"use client";

import Link from "next/link";
import { useState } from "react";
import { signIn, useSession } from "next-auth/react";
import {
  EmptyStateCard,
  PrimaryButton,
  SectionHeader,
  SecondaryButton,
} from "@/components/product/ProductUI";

type BountyComment = {
  id: string;
  body: string;
  createdAt: string;
  author: {
    id: string;
    username: string | null;
    displayName: string | null;
    image: string | null;
  };
};

type BountyCommentsClientProps = {
  bountyId: string;
  initialComments: BountyComment[];
};

function formatCommentTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function initialsForName(value: string) {
  const pieces = value
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);

  if (pieces.length === 0) return "?";
  return pieces.map((piece) => piece[0]?.toUpperCase() ?? "").join("");
}

export function BountyCommentsClient({
  bountyId,
  initialComments,
}: BountyCommentsClientProps) {
  const { data: session } = useSession();
  const [comments, setComments] = useState(initialComments);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setError("");

    if (!session?.user?.id) {
      await signIn();
      return;
    }

    const body = draft.trim();
    if (body.length < 2) {
      setError("Comment must be at least 2 characters.");
      return;
    }

    setSending(true);
    try {
      const response = await fetch(`/api/bounties/${bountyId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const payload = (await response.json()) as BountyComment & { error?: string };
      if (!response.ok) {
        setError(payload.error || "Unable to post comment.");
        setSending(false);
        return;
      }

      setComments((prev) => [...prev, payload]);
      setDraft("");
      setSending(false);
    } catch {
      setError("Unable to post comment.");
      setSending(false);
    }
  };

  return (
    <section className="listing-system-feed bounty-comments-section">
      <SectionHeader
        title="Comments"
        subtitle="Talk through condition, leads, and potential matches."
        action={<span className="market-count">{comments.length}</span>}
      />

      <div className="product-card bounty-comments-card">
        {comments.length === 0 ? (
          <EmptyStateCard
            title="No comments yet."
            description="Start the discussion around this bounty."
            className="bounty-comments-empty"
          />
        ) : (
          <div className="bounty-comment-list">
            {comments.map((comment) => {
              const name = comment.author.displayName ?? comment.author.username ?? "Collector";
              return (
                <article key={comment.id} className="bounty-comment">
                  <div className="bounty-comment-avatar" aria-hidden="true">
                    {initialsForName(name)}
                  </div>
                  <div className="bounty-comment-body">
                    <div className="bounty-comment-head">
                      <Link
                        href={comment.author.username ? `/u/${comment.author.username}` : `/profiles/${comment.author.id}`}
                        className="bounty-comment-author"
                      >
                        {name}
                      </Link>
                      <span>{formatCommentTime(comment.createdAt)}</span>
                    </div>
                    <p>{comment.body}</p>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <div className="bounty-comment-compose">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Comment on the bounty, condition target, or possible match"
            rows={3}
            maxLength={400}
            className="bounty-comment-input"
            disabled={sending}
          />
          <div className="bounty-comment-compose-foot">
            <span>{draft.trim().length}/400</span>
            {session?.user?.id ? (
              <PrimaryButton onClick={() => void handleSubmit()} disabled={sending || draft.trim().length < 2}>
                {sending ? "Posting..." : "Post comment"}
              </PrimaryButton>
            ) : (
              <SecondaryButton onClick={() => signIn()}>Sign in to comment</SecondaryButton>
            )}
          </div>
          {error ? <p className="app-status-note is-error">{error}</p> : null}
        </div>
      </div>
    </section>
  );
}
