"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckersLoader } from "@/components/CheckersLoader";

type SellerApplication = {
  id: string;
  status: string;
  createdAt: string;
  manualNotes: string | null;
  user: {
    id: string;
    email: string | null;
    displayName: string | null;
    phone: string | null;
  };
  verifications: { id: string; type: string; status: string }[];
};

export default function SellerAdminPage() {
  const [applications, setApplications] = useState<SellerApplication[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [notesById, setNotesById] = useState<Record<string, string>>({});

  const fetchApplications = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/sellers");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Unable to load applications.");
      }
      setApplications(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load applications.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, []);

  const handleDecision = async (id: string, status: "APPROVED" | "REJECTED") => {
    setError("");
    try {
      const response = await fetch(`/api/admin/sellers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, notes: notesById[id] }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Unable to update application.");
      }
      setApplications((prev) => prev.filter((app) => app.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update application.");
    }
  };

  const handleVerificationUpdate = async (
    sellerId: string,
    verificationId: string,
    status: "PENDING" | "PASSED" | "FAILED",
  ) => {
    setError("");
    try {
      const response = await fetch(`/api/admin/sellers/${sellerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verifications: [{ id: verificationId, status }] }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Unable to update verification.");
      }
      setApplications((prev) =>
        prev.map((app) =>
          app.id === sellerId
            ? {
                ...app,
                verifications: app.verifications.map((check) =>
                  check.id === verificationId ? { ...check, status } : check,
                ),
              }
            : app,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update verification.");
    }
  };

  const handleMarkAllPassed = async (app: SellerApplication) => {
    setError("");
    try {
      const response = await fetch(`/api/admin/sellers/${app.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          verifications: app.verifications.map((check) => ({ id: check.id, status: "PASSED" })),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Unable to update verifications.");
      }
      setApplications((prev) =>
        prev.map((entry) =>
          entry.id === app.id
            ? { ...entry, verifications: entry.verifications.map((check) => ({ ...check, status: "PASSED" })) }
            : entry,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update verifications.");
    }
  };

  const filtered = applications.filter((app) => {
    if (!query.trim()) return true;
    const target = `${app.user.displayName ?? ""} ${app.user.email ?? ""} ${app.user.phone ?? ""}`.toLowerCase();
    return target.includes(query.toLowerCase());
  });

  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <p className="app-eyebrow">Admin desk</p>
        <h1 className="admin-page-title">Seller verification queue</h1>
        <p className="admin-page-subtitle">Approve or reject pending seller applications.</p>
      </div>

      <div className="admin-panel">
        <div className="admin-search-row">
          <div>
            <p className="app-eyebrow">Admin access</p>
            <p className="admin-page-subtitle">Signed session for a configured admin account is required.</p>
            <div className="admin-nav">
              <Link href="/admin/sellers" className="admin-nav-tab is-active">Seller Queue</Link>
              <Link href="/admin/profiles" className="admin-nav-tab">Profiles</Link>
            </div>
          </div>
          <div className="admin-controls">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search seller/email"
              className="app-form-input"
            />
            <button onClick={fetchApplications} className="app-button app-button-primary">
              Refresh
            </button>
          </div>
        </div>
        {error ? <p className="app-status-note is-error">{error}</p> : null}
      </div>

      <section className="admin-list">
        {loading && (
          <div className="admin-empty">
            <CheckersLoader title="Loading applications..." compact />
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <p className="admin-empty">No pending applications.</p>
        )}
        {filtered.map((app) => (
          <div key={app.id} className="admin-card">
            <div className="admin-card-identity">
              <div>
                <p className="admin-card-name">{app.user.displayName || "New seller"}</p>
                <p>{app.user.email ?? "No email"}</p>
                <p>{app.user.phone ?? "No phone"}</p>
              </div>
              <div className="admin-card-actions">
                <button
                  onClick={() => handleMarkAllPassed(app)}
                  className="app-button app-button-secondary"
                >
                  Mark all passed
                </button>
                <button
                  onClick={() => handleDecision(app.id, "APPROVED")}
                  className="app-button app-button-approve"
                >
                  Approve
                </button>
                <button
                  onClick={() => handleDecision(app.id, "REJECTED")}
                  className="app-button app-button-danger"
                >
                  Reject
                </button>
              </div>
            </div>
            <div className="admin-verifications">
              {app.verifications.map((check) => (
                <div key={check.id} className="admin-verification-row">
                  <span className="admin-verification-label">
                    {check.type.replace("_", " ")}
                  </span>
                  <div className="admin-verification-btns">
                    {(["PENDING", "PASSED", "FAILED"] as const).map((status) => (
                      <button
                        key={status}
                        onClick={() => handleVerificationUpdate(app.id, check.id, status)}
                        className={`admin-verification-btn${check.status === status ? ` is-${status.toLowerCase()}` : ""}`}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <textarea
              value={notesById[app.id] ?? app.manualNotes ?? ""}
              onChange={(event) =>
                setNotesById((prev) => ({ ...prev, [app.id]: event.target.value }))
              }
              placeholder="Reviewer notes"
              rows={3}
              className="app-form-textarea admin-notes-input"
            />
            {app.manualNotes && (
              <p className="admin-notes-text">{app.manualNotes}</p>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
