import "server-only";
import { getSessionUser } from "@/lib/auth";

export function getAdminEmails() {
  return (process.env.ADMIN_EMAILS ?? process.env.ADMIN_EMAIL ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email?: string | null) {
  if (!email) return false;
  const adminEmails = getAdminEmails();
  return adminEmails.length > 0 && adminEmails.includes(email.toLowerCase());
}

export async function requireAdmin(request: Request) {
  const sessionUser = await getSessionUser();
  if (isAdminEmail(sessionUser?.email)) {
    return { ok: true, user: sessionUser } as const;
  }

  if (sessionUser?.role === "ADMIN") {
    return { ok: true, user: sessionUser } as const;
  }

  const adminKey = request.headers.get("x-admin-key");
  const allowedKey = process.env.ADMIN_KEY;

  if (allowedKey && adminKey && adminKey === allowedKey) {
    return { ok: true } as const;
  }

  // Never trust caller-provided user identifiers for auth.
  // Admin access must be established via a signed session (NextAuth) or a shared secret (x-admin-key).
  return { ok: false, status: 401, error: "Missing admin credentials." } as const;
}
