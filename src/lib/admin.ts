import "server-only";
import { getSessionUser } from "@/lib/auth";

export const PRIMARY_ADMIN_EMAIL = "achyuta.2006@gmail.com";

export function getAdminEmails() {
  return [PRIMARY_ADMIN_EMAIL];
}

export function isAdminEmail(email?: string | null) {
  if (!email) return false;
  return email.trim().toLowerCase() === PRIMARY_ADMIN_EMAIL;
}

export async function requireAdmin(request: Request) {
  void request;
  const sessionUser = await getSessionUser();
  if (isAdminEmail(sessionUser?.email)) {
    return { ok: true, user: sessionUser } as const;
  }

  return { ok: false, status: 401, error: "Missing admin credentials." } as const;
}
