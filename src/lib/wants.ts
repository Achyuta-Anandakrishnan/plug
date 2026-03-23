export const WANT_REQUEST_STATUSES = ["OPEN", "FULFILLED", "EXPIRED", "PAUSED"] as const;

export type WantRequestStatus = (typeof WANT_REQUEST_STATUSES)[number];

export type WantRequestListItem = {
  id: string;
  userId: string;
  title: string;
  category: string | null;
  itemName: string;
  grade: string | null;
  condition: string | null;
  certNumber: string | null;
  priceMin: number | null;
  priceMax: number | null;
  notes: string | null;
  imageUrl: string | null;
  status: WantRequestStatus;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    username: string | null;
    displayName: string | null;
    image?: string | null;
  };
};

export type WantRequestDetail = WantRequestListItem & {
  savesCount?: number;
};

export type WantSortMode = "newest" | "highest-budget" | "most-specific" | "recently-active";

export function wantPriceLabel(priceMin: number | null, priceMax: number | null) {
  if (priceMin !== null && priceMax !== null) {
    return `Paying $${priceMin.toLocaleString()}-$${priceMax.toLocaleString()}`;
  }
  if (priceMin !== null) return `Paying from $${priceMin.toLocaleString()}`;
  if (priceMax !== null) return `Paying up to $${priceMax.toLocaleString()}`;
  return "Budget on request";
}

export function wantBudgetValue(want: Pick<WantRequestListItem, "priceMin" | "priceMax">) {
  return Math.max(want.priceMax ?? 0, want.priceMin ?? 0);
}

export function wantSpecificityScore(
  want: Pick<WantRequestListItem, "grade" | "condition" | "certNumber" | "notes" | "imageUrl" | "category">,
) {
  let score = 0;
  if (want.grade) score += 3;
  if (want.condition) score += 2;
  if (want.certNumber) score += 2;
  if (want.notes) score += 1;
  if (want.imageUrl) score += 1;
  if (want.category) score += 1;
  return score;
}

export function compactWantMeta(want: Pick<WantRequestListItem, "grade" | "condition" | "certNumber" | "category">) {
  const parts = [
    want.grade?.trim(),
    want.condition?.trim(),
    want.certNumber?.trim() ? `Cert ${want.certNumber.trim()}` : "",
    want.category?.trim(),
  ].filter(Boolean);

  return parts.join(" • ") || "Looking for the right copy";
}

export function compactWantActivity(notes: string | null | undefined) {
  const trimmed = typeof notes === "string" ? notes.trim() : "";
  if (!trimmed) return "Demand posted";
  if (trimmed.length <= 52) return trimmed;
  return `${trimmed.slice(0, 49)}...`;
}

export function isWantRequestStatus(value: unknown): value is WantRequestStatus {
  return typeof value === "string" && WANT_REQUEST_STATUSES.includes(value as WantRequestStatus);
}
