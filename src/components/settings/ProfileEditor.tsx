"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { CheckersLoader } from "@/components/CheckersLoader";

type ProfilePayload = {
  id: string;
  email: string | null;
  emailVerified: string | null;
  role: string;
  username: string | null;
  displayName: string | null;
  bio: string | null;
  image: string | null;
  createdAt: string;
};

export function ProfileEditor() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const setupMode = searchParams.get("setup") === "1";
  const suggestedUsername = (searchParams.get("username") ?? "").trim();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [sendingVerification, setSendingVerification] = useState(false);
  const [profile, setProfile] = useState<ProfilePayload | null>(null);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [image, setImage] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!session?.user?.id) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError("");
      try {
        const response = await fetch("/api/profile");
        const payload = (await response.json()) as ProfilePayload & { error?: string };
        if (!response.ok) {
          setError(payload.error ?? "Unable to load profile.");
          setLoading(false);
          return;
        }
        if (cancelled) return;
        setProfile(payload);
        setUsername(payload.username ?? suggestedUsername);
        setDisplayName(payload.displayName ?? "");
        setBio(payload.bio ?? "");
        setImage(payload.image ?? "");
        setLoading(false);
      } catch {
        if (!cancelled) {
          setError("Unable to load profile.");
          setLoading(false);
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id, suggestedUsername]);

  if (!session?.user?.id) {
    return (
      <div className="app-status-note">
        Sign in to manage your profile.
        <div style={{ marginTop: "12px" }}>
          <button
            type="button"
            onClick={() => void signIn()}
            className="app-button app-button-primary"
            style={{ minHeight: "34px", fontSize: "12px" }}
          >
            Sign in
          </button>
        </div>
      </div>
    );
  }

  const onSave = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, displayName, bio, image }),
      });
      const payload = (await response.json()) as ProfilePayload & { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Unable to save profile.");
        setSaving(false);
        return;
      }
      setProfile(payload);
      setUsername(payload.username ?? "");
      setDisplayName(payload.displayName ?? "");
      setBio(payload.bio ?? "");
      setImage(payload.image ?? "");
      setSuccess("Profile updated.");
    } catch {
      setError("Unable to save profile.");
    } finally {
      setSaving(false);
    }
  };

  const onUpload: React.ChangeEventHandler<HTMLInputElement> = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    setSuccess("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/profile/avatar", { method: "POST", body: formData });
      const payload = (await response.json()) as {
        image?: string | null;
        username?: string | null;
        displayName?: string | null;
        bio?: string | null;
        error?: string;
      };
      if (!response.ok) {
        setError(payload.error ?? "Unable to upload avatar.");
        return;
      }
      setImage(payload.image ?? "");
      setProfile((prev) => prev ? { ...prev, image: payload.image ?? null } : prev);
      setSuccess("Avatar updated.");
    } catch {
      setError("Unable to upload avatar.");
    } finally {
      event.target.value = "";
      setUploading(false);
    }
  };

  const onSendVerification = async () => {
    setSendingVerification(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/email/verification/send", { method: "POST" });
      const payload = (await response.json()) as { sent?: boolean; alreadyVerified?: boolean; error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Unable to send verification email.");
        return;
      }
      if (payload.alreadyVerified) {
        setSuccess("Email is already verified.");
        return;
      }
      setSuccess(payload.sent ? "Verification email sent." : "SMTP not configured.");
    } catch {
      setError("Unable to send verification email.");
    } finally {
      setSendingVerification(false);
    }
  };

  return (
    <div className="settings-profile-stack">
      {loading ? (
        <CheckersLoader title="Loading profile..." compact />
      ) : (
        <div className="grid gap-4">
          {setupMode ? (
            <p className="app-status-note">
              Finish profile setup so buyers and sellers can find you by username.
            </p>
          ) : null}
          {error ? <p className="app-status-note is-error">{error}</p> : null}
          {success ? <p className="app-status-note is-success">{success}</p> : null}

          <div className="settings-profile-card">
            <p className="app-eyebrow">Profile photo</p>
            <div className="settings-avatar-row">
              <div className="settings-avatar-wrap">
                {image ? (
                  <Image
                    src={image}
                    alt="Profile photo"
                    fill
                    sizes="64px"
                    className="object-cover"
                    unoptimized
                  />
                ) : null}
              </div>
              <label className="app-button app-button-secondary settings-avatar-upload">
                {uploading ? "Uploading…" : "Upload avatar"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="settings-file-input"
                  onChange={onUpload}
                  disabled={uploading}
                />
              </label>
            </div>
          </div>

          <div className="settings-account-card">
            <p className="app-eyebrow">Public profile</p>
            <div className="settings-account-meta">
              <span>{profile?.email ?? "No email"}</span>
              <span>·</span>
              <span>{profile?.emailVerified ? "Email verified" : "Not verified"}</span>
              {!profile?.emailVerified && profile?.email ? (
                <button
                  type="button"
                  onClick={() => void onSendVerification()}
                  disabled={sendingVerification}
                  className="app-button app-button-secondary"
                  style={{ minHeight: "30px", fontSize: "12px" }}
                >
                  {sendingVerification ? "Sending…" : "Verify email"}
                </button>
              ) : null}
            </div>

            <div className="app-form-container settings-form-column">
              <div className="app-form-field">
                <label className="app-form-label">Username</label>
                <input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  className="app-form-input"
                  placeholder="your_username"
                />
              </div>
              <div className="app-form-field">
                <label className="app-form-label">Display name</label>
                <input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  className="app-form-input"
                  placeholder="Your name"
                />
              </div>
              <div className="app-form-field">
                <label className="app-form-label">Bio</label>
                <textarea
                  value={bio}
                  onChange={(event) => setBio(event.target.value)}
                  rows={3}
                  className="app-form-textarea"
                  placeholder="Tell buyers and sellers about yourself…"
                />
              </div>
            </div>

            <div className="app-form-actions settings-account-actions">
              <button
                type="button"
                onClick={() => void onSave()}
                disabled={saving}
                className="app-button app-button-primary"
              >
                {saving ? "Saving…" : "Save profile"}
              </button>
              {profile?.username ? (
                <Link href={`/u/${profile.username}`} className="app-button app-button-secondary">
                  View public profile
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
