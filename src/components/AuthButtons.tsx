"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getProviders, signIn, signOut, useSession } from "next-auth/react";

function normalizeUsername(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_")
    .slice(0, 24);
}

export function AuthButtons() {
  const { data: session, status } = useSession();
  const [username, setUsername] = useState("");
  const [providers, setProviders] = useState<Record<string, { id: string; name: string }> | null>(
    null,
  );

  useEffect(() => {
    getProviders().then((result) => {
      setProviders(result ?? {});
    });
  }, []);

  if (status === "loading") {
    return <p className="app-status-note">Checking session...</p>;
  }

  if (session?.user?.id) {
    const needsSetup = !session.user.username || !session.user.displayName;
    return (
      <div className="auth-buttons-stack">
        <p className="app-status-note is-success">
          Signed in as {session.user.email ?? session.user.name ?? "account"}.
        </p>
        {needsSetup ? (
          <Link href="/settings?setup=1" className="app-button app-button-primary">
            Complete profile setup
          </Link>
        ) : null}
        <button type="button" onClick={() => signOut()} className="app-button app-button-secondary">
          Sign out
        </button>
      </div>
    );
  }

  const googleAvailable = Boolean(providers?.google);
  const appleAvailable = Boolean(providers?.apple);
  const normalizedUsername = normalizeUsername(username);
  const usernameValid = /^[a-z0-9_]{3,24}$/.test(normalizedUsername);
  const callbackUrl = usernameValid
    ? `/settings?setup=1&username=${encodeURIComponent(normalizedUsername)}`
    : "/settings?setup=1";

  return (
    <div className="auth-buttons-stack">
      <button
        type="button"
        onClick={() => signIn("google", { callbackUrl })}
        disabled={!googleAvailable}
        className="app-button app-button-secondary"
      >
        {!googleAvailable ? "Google not configured" : "Continue with Google"}
      </button>
      <button
        type="button"
        onClick={() => signIn("apple", { callbackUrl })}
        disabled={!appleAvailable}
        className="app-button app-button-secondary"
      >
        {!appleAvailable ? "Apple not configured" : "Continue with Apple"}
      </button>
      <div className="auth-username-field">
        <label className="app-eyebrow">Username (optional)</label>
        <input
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="Pick a username now, or set it later"
          className="app-form-input"
        />
        {username.trim() && !usernameValid ? (
          <p className="app-form-hint is-warning">
            We&apos;ll ignore this until it matches 3-24 lowercase letters, numbers, or underscores.
          </p>
        ) : null}
      </div>
    </div>
  );
}
