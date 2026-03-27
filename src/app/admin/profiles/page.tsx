"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckersLoader } from "@/components/CheckersLoader";

type AdminProfile = {
  id: string;
  email: string | null;
  username: string | null;
  displayName: string | null;
  bio: string | null;
  image: string | null;
  role: string;
  accountStatus: string;
  createdAt: string;
  sellerProfile: {
    status: string;
    trustTier: number;
  } | null;
};

type ProfileDraft = {
  role: string;
  accountStatus: string;
};

const ROLE_OPTIONS = ["BUYER", "SELLER", "ADMIN"] as const;
const ACCOUNT_STATUS_OPTIONS = ["ACTIVE", "SUSPENDED", "DISABLED"] as const;

export default function AdminProfilesPage() {
  const [profiles, setProfiles] = useState<AdminProfile[]>([]);
  const [drafts, setDrafts] = useState<Record<string, ProfileDraft>>({});
  const [savingById, setSavingById] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  const fetchProfiles = async (q = "") => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      params.set("limit", "1000");
      if (q.trim()) params.set("q", q.trim());
      const response = await fetch(`/api/admin/profiles?${params.toString()}`);
      const data = (await response.json()) as AdminProfile[] & { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Unable to load profiles.");
      }
      setProfiles(data);
      setDrafts(
        Object.fromEntries(
          data.map((profile) => [
            profile.id,
            {
              role: profile.role,
              accountStatus: profile.accountStatus,
            },
          ]),
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load profiles.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchProfiles();
  }, []);

  const handleDraftChange = (
    profileId: string,
    field: keyof ProfileDraft,
    value: string,
  ) => {
    setDrafts((prev) => ({
      ...prev,
      [profileId]: {
        role: prev[profileId]?.role ?? "BUYER",
        accountStatus: prev[profileId]?.accountStatus ?? "ACTIVE",
        [field]: value,
      },
    }));
  };

  const handleProfileSave = async (profile: AdminProfile) => {
    const draft = drafts[profile.id];
    if (!draft) return;

    setError("");
    setSavingById((prev) => ({ ...prev, [profile.id]: true }));
    try {
      const response = await fetch(`/api/admin/profiles/${profile.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: draft.role,
          accountStatus: draft.accountStatus,
        }),
      });
      const data = (await response.json()) as AdminProfile & { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Unable to update profile.");
      }

      setProfiles((prev) => prev.map((entry) => (entry.id === profile.id ? data : entry)));
      setDrafts((prev) => ({
        ...prev,
        [profile.id]: {
          role: data.role,
          accountStatus: data.accountStatus,
        },
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update profile.");
    } finally {
      setSavingById((prev) => ({ ...prev, [profile.id]: false }));
    }
  };

  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <p className="app-eyebrow">Admin desk</p>
        <h1 className="admin-page-title">All profiles</h1>
        <p className="admin-page-subtitle">View every account, update status, and grant admin access.</p>
      </div>

      <div className="admin-panel">
        <div className="admin-search-row">
          <div className="admin-nav">
            <Link href="/admin/sellers" className="admin-nav-tab">Seller Queue</Link>
            <Link href="/admin/profiles" className="admin-nav-tab is-active">Profiles</Link>
          </div>
          <div className="admin-controls">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search username, email, display name"
              className="app-form-input"
            />
            <button
              type="button"
              onClick={() => void fetchProfiles(query)}
              className="app-button app-button-primary"
            >
              Search
            </button>
          </div>
        </div>
        {error ? <p className="app-status-note is-error">{error}</p> : null}
      </div>

      {loading ? (
        <div className="admin-empty">
          <CheckersLoader title="Loading profiles..." compact />
        </div>
      ) : (
        <section className="admin-profiles-grid">
          {profiles.map((profile) => (
            <div key={profile.id} className="admin-card">
              <div className="admin-card-identity">
                <div>
                  <p className="admin-card-name">{profile.displayName ?? "User"}</p>
                  <p className="admin-card-meta-text">
                    {profile.username ? `@${profile.username}` : "No username"}
                  </p>
                  <p className="admin-card-meta-text">{profile.email ?? "No email"}</p>
                </div>
                <div className="admin-card-statuses">
                  <span className="admin-badge">{profile.role}</span>
                  <span className="admin-badge">{profile.accountStatus}</span>
                </div>
              </div>
              <div className="admin-card-tags">
                <span className="admin-tag">Seller: {profile.sellerProfile?.status ?? "N/A"}</span>
                <span className="admin-tag">Trust tier: {profile.sellerProfile?.trustTier ?? "-"}</span>
              </div>
              <div className="admin-card-management">
                <label className="admin-select-field">
                  <span className="admin-select-label">Role</span>
                  <select
                    value={drafts[profile.id]?.role ?? profile.role}
                    onChange={(event) => handleDraftChange(profile.id, "role", event.target.value)}
                    className="admin-select-input"
                  >
                    {ROLE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="admin-select-field">
                  <span className="admin-select-label">Account status</span>
                  <select
                    value={drafts[profile.id]?.accountStatus ?? profile.accountStatus}
                    onChange={(event) => handleDraftChange(profile.id, "accountStatus", event.target.value)}
                    className="admin-select-input"
                  >
                    {ACCOUNT_STATUS_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => void handleProfileSave(profile)}
                  className="app-button app-button-primary"
                  disabled={
                    savingById[profile.id]
                    || (
                      (drafts[profile.id]?.role ?? profile.role) === profile.role
                      && (drafts[profile.id]?.accountStatus ?? profile.accountStatus) === profile.accountStatus
                    )
                  }
                >
                  {savingById[profile.id] ? "Saving..." : "Save access"}
                </button>
              </div>
              {profile.bio ? <p className="admin-card-bio">{profile.bio}</p> : null}
              <div className="admin-card-links">
                <Link
                  href={profile.username ? `/u/${profile.username}` : `/profiles/${profile.id}`}
                  className="app-button app-button-secondary"
                >
                  Open profile
                </Link>
                <Link href="/messages" className="app-button app-button-secondary">
                  Open messages
                </Link>
              </div>
            </div>
          ))}
          {!profiles.length && !error ? (
            <p className="admin-empty">No profiles found.</p>
          ) : null}
        </section>
      )}
    </div>
  );
}
