export const ACCOUNT_STATUSES = ["ACTIVE", "SUSPENDED", "DISABLED"] as const;

export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export function isAccountStatus(value: string | null | undefined): value is AccountStatus {
  return ACCOUNT_STATUSES.includes((value ?? "").toUpperCase() as AccountStatus);
}

export function normalizeAccountStatus(value: string | null | undefined): AccountStatus {
  const normalized = (value ?? "").trim().toUpperCase();
  return isAccountStatus(normalized) ? normalized : "ACTIVE";
}

export function isBlockedAccountStatus(value: string | null | undefined) {
  const status = normalizeAccountStatus(value);
  return status === "SUSPENDED" || status === "DISABLED";
}
