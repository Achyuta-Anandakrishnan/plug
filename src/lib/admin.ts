import "server-only";
import { getSessionUser } from "@/lib/auth";
import { PRIMARY_ADMIN_EMAIL, isPrimaryAdminEmail } from "@/lib/admin-email";

export { PRIMARY_ADMIN_EMAIL };

export function getAdminEmails() {
  return [PRIMARY_ADMIN_EMAIL];
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
