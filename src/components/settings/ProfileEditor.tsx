"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn, useSession } from "next-auth/react";

type ProfilePayload = {
  id: string;
  email: string | null;
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
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white/70 px-5 py-6 text-sm text-slate-600">
        Sign in to manage your profile.
        <div className="mt-3">
          <button
            type="button"
            onClick={() => void signIn()}
            className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
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
        body: JSON.stringify({
          username,
          displayName,
          bio,
          image,
        }),
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
      const response = await fetch("/api/profile/avatar", {
        method: "POST",
        body: formData,
      });
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

  return (
    <div className="space-y-4">
      {loading ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white/70 px-5 py-6 text-sm text-slate-500">
          Loading profile...
        </div>
      ) : (
        <div className="grid gap-4">
          {setupMode ? (
            <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
              Finish profile setup so buyers and sellers can find you by username.
            </div>
          ) : null}
          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}
          {success ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {success}
            </div>
          ) : null}

          <div className="rounded-2xl border border-white/70 bg-white/80 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
              Profile photo
            </p>
            <div className="mt-3 flex items-center gap-4">
              <div className="relative h-16 w-16 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
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
              <label className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
                {uploading ? "Uploading..." : "Upload avatar"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={onUpload}
                  disabled={uploading}
                />
              </label>
            </div>
          </div>

          <div className="rounded-2xl border border-white/70 bg-white/80 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
              Public profile
            </p>
            <div className="mt-3 grid gap-3">
              <label className="grid gap-1">
                <span className="text-xs text-slate-500">Username</span>
                <input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[var(--royal)]"
                  placeholder="your_username"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-xs text-slate-500">Display name</span>
                <input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[var(--royal)]"
                  placeholder="Your name"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-xs text-slate-500">Bio</span>
                <textarea
                  value={bio}
                  onChange={(event) => setBio(event.target.value)}
                  rows={3}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[var(--royal)]"
                  placeholder="Tell buyers and sellers about yourself..."
                />
              </label>
              <label className="grid gap-1">
                <span className="text-xs text-slate-500">Photo URL (optional)</span>
                <input
                  value={image}
                  onChange={(event) => setImage(event.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[var(--royal)]"
                  placeholder="https://..."
                />
              </label>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void onSave()}
                disabled={saving}
                className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save profile"}
              </button>
              {profile?.username ? (
                <Link
                  href={`/u/${profile.username}`}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700"
                >
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
