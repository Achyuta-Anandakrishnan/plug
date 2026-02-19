import "server-only";
import { getSessionUser } from "@/lib/auth";
import { getConfiguredAdminEmails, isConfiguredAdminEmail } from "@/lib/admin-email";

export function getAdminEmails() {
  return getConfiguredAdminEmails();
}

export function isAdminEmail(email?: string | null) {
  return isConfiguredAdminEmail(email, getAdminEmails());
}

export async function requireAdmin(request: Request) {
  void request;
  const sessionUser = await getSessionUser();
  if (sessionUser?.role === "ADMIN") {
    return { ok: true, user: sessionUser } as const;
  }
  if (isAdminEmail(sessionUser?.email)) {
    return { ok: true, user: sessionUser } as const;
  }

  return { ok: false, status: 401, error: "Missing admin credentials." } as const;
}
