import "server-only";
import { getSessionUser } from "@/lib/auth";
import { PRIMARY_ADMIN_EMAIL as ADMIN_EMAIL_CANON, isPrimaryAdminEmail } from "@/lib/admin-email";

export function getAdminEmails() {
  return [ADMIN_EMAIL_CANON];
}

export function isAdminEmail(email?: string | null) {
  return isPrimaryAdminEmail(email);
}

export async function requireAdmin(request: Request) {
  void request;
  const sessionUser = await getSessionUser();
  if (isAdminEmail(sessionUser?.email)) {
    return { ok: true, user: sessionUser } as const;
  }

  return { ok: false, status: 401, error: "Missing admin credentials." } as const;
}
