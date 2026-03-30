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

export function getConfiguredAdminEmails() {
  return (process.env.ADMIN_EMAILS ?? process.env.ADMIN_EMAIL ?? "")
    .split(",")
    .map((email) => normalizeAdminEmail(email))
    .filter(Boolean);
}

export function isConfiguredAdminEmail(
  email?: string | null,
  adminEmails: string[] = getConfiguredAdminEmails(),
) {
  const normalized = normalizeAdminEmail(email);
  if (!normalized) return false;
  return adminEmails.includes(normalized);
}
