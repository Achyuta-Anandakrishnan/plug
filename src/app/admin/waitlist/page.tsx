"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckersLoader } from "@/components/CheckersLoader";

type WaitlistEntry = {
  id: string;
  email: string;
  name: string | null;
  source: string | null;
  createdAt: string;
};

function formatJoinedAt(value: string) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export default function AdminWaitlistPage() {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  const fetchEntries = async (q = "") => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      params.set("limit", "1000");
      if (q.trim()) params.set("q", q.trim());
      const response = await fetch(`/api/admin/waitlist?${params.toString()}`);
      const data = (await response.json()) as WaitlistEntry[] & { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Unable to load waitlist.");
      }
      setEntries(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load waitlist.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchEntries();
  }, []);

  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <p className="app-eyebrow">Admin desk</p>
        <h1 className="admin-page-title">Waitlist</h1>
        <p className="admin-page-subtitle">View everyone who joined the dalow waitlist.</p>
      </div>

      <div className="admin-panel">
        <div className="admin-search-row">
          <div className="admin-nav">
            <Link href="/admin/sellers" className="admin-nav-tab">Seller Queue</Link>
            <Link href="/admin/profiles" className="admin-nav-tab">Profiles</Link>
            <Link href="/admin/waitlist" className="admin-nav-tab is-active">Waitlist</Link>
          </div>
          <div className="admin-controls">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search email, name, source"
              className="app-form-input"
            />
            <button
              type="button"
              onClick={() => void fetchEntries(query)}
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
          <CheckersLoader title="Loading waitlist..." compact />
        </div>
      ) : entries.length ? (
        <section className="admin-table-shell">
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Name</th>
                  <th>Source</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.email}</td>
                    <td>{entry.name || "—"}</td>
                    <td>{entry.source || "manual"}</td>
                    <td>{formatJoinedAt(entry.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <p className="admin-empty">No waitlist entries yet.</p>
      )}
    </div>
  );
}
