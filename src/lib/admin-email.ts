export const PRIMARY_ADMIN_EMAIL = "achyuta.2006@gmail.com";

function normalizeGmail(email: string) {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const isGmail = domain === "gmail.com" || domain === "googlemail.com";
  if (!isGmail) return email;
  const normalizedLocal = local.split("+")[0].replace(/\./g, "");
  return `${normalizedLocal}@gmail.com`;
}

export function normalizeAdminEmail(email?: string | null) {
  if (!email) return "";
  const normalized = email.trim().toLowerCase();
  return normalizeGmail(normalized);
}

export function isPrimaryAdminEmail(email?: string | null) {
  return normalizeAdminEmail(email) === normalizeAdminEmail(PRIMARY_ADMIN_EMAIL);
}
