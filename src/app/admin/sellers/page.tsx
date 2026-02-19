"use client";

import { useEffect, useState } from "react";

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
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status, notes: notesById[id] }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Unable to update application.");
      }
      setApplications((prev) => prev.filter((app) => app.id !== id));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to update application.",
      );
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
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          verifications: [{ id: verificationId, status }],
        }),
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
                  check.id === verificationId
                    ? { ...check, status }
                    : check,
                ),
              }
            : app,
        ),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to update verification.",
      );
    }
  };

  const handleMarkAllPassed = async (app: SellerApplication) => {
    setError("");
    try {
      const response = await fetch(`/api/admin/sellers/${app.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          verifications: app.verifications.map((check) => ({
            id: check.id,
            status: "PASSED",
          })),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Unable to update verifications.");
      }
      setApplications((prev) =>
        prev.map((entry) =>
          entry.id === app.id
            ? {
                ...entry,
                verifications: entry.verifications.map((check) => ({
                  ...check,
                  status: "PASSED",
                })),
              }
            : entry,
        ),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to update verifications.",
      );
    }
  };

  const filtered = applications.filter((app) => {
    if (!query.trim()) return true;
    const target = `${app.user.displayName ?? ""} ${app.user.email ?? ""} ${app.user.phone ?? ""}`.toLowerCase();
    return target.includes(query.toLowerCase());
  });

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
          Admin desk
        </p>
        <h1 className="font-display text-3xl text-slate-900">
          Seller verification queue
        </h1>
        <p className="text-sm text-slate-600">
          Approve or reject pending seller applications.
        </p>
      </div>

      <div className="surface-panel rounded-[28px] p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
              Admin access
            </p>
            <p className="text-sm text-slate-600">
              Signed session for a configured admin account is required.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search seller/email"
              className="rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-sm text-slate-700 outline-none"
            />
            <button
              onClick={fetchApplications}
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            >
              Refresh
            </button>
          </div>
        </div>
        {error && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-600">
            {error}
          </div>
        )}
      </div>

      <section className="grid gap-5">
        {loading && (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 px-6 py-10 text-sm text-slate-500">
            Loading applications...
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 px-6 py-10 text-sm text-slate-500">
            No pending applications.
          </div>
        )}
        {filtered.map((app) => {
          return (
          <div
            key={app.id}
            className="surface-panel rounded-[24px] p-6 text-sm text-slate-600"
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="font-display text-lg text-slate-900">
                  {app.user.displayName || "New seller"}
                </p>
                <p>{app.user.email ?? "No email"}</p>
                <p>{app.user.phone ?? "No phone"}</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => handleMarkAllPassed(app)}
                  className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600"
                >
                  Mark all passed
                </button>
                <button
                  onClick={() => handleDecision(app.id, "APPROVED")}
                  className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-white"
                >
                  Approve
                </button>
                <button
                  onClick={() => handleDecision(app.id, "REJECTED")}
                  className="rounded-full bg-rose-500 px-4 py-2 text-xs font-semibold text-white"
                >
                  Reject
                </button>
              </div>
            </div>
            <div className="mt-4 grid gap-2 text-xs">
              {app.verifications.map((check) => (
                <div
                  key={check.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/70 bg-white/70 px-4 py-2"
                >
                  <span className="uppercase tracking-[0.18em] text-slate-500">
                    {check.type.replace("_", " ")}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {(["PENDING", "PASSED", "FAILED"] as const).map((status) => (
                      <button
                        key={status}
                        onClick={() =>
                          handleVerificationUpdate(app.id, check.id, status)
                        }
                        className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${
                          check.status === status
                            ? status === "PASSED"
                              ? "bg-emerald-100 text-emerald-700"
                              : status === "FAILED"
                                ? "bg-rose-100 text-rose-600"
                                : "bg-slate-200 text-slate-600"
                            : "bg-white text-slate-400"
                        }`}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <textarea
                value={notesById[app.id] ?? app.manualNotes ?? ""}
                onChange={(event) =>
                  setNotesById((prev) => ({ ...prev, [app.id]: event.target.value }))
                }
                placeholder="Reviewer notes"
                rows={3}
                className="w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-xs text-slate-700 outline-none focus:border-[var(--royal)]"
              />
            </div>
            {app.manualNotes && (
              <p className="mt-3 text-xs text-slate-500">{app.manualNotes}</p>
            )}
          </div>
        );
        })}
      </section>
    </div>
  );
}
