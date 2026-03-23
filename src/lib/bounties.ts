export const BOUNTY_REQUEST_STATUSES = ["OPEN", "MATCHED", "FULFILLED", "EXPIRED", "PAUSED"] as const;

export type BountyRequestStatus = (typeof BOUNTY_REQUEST_STATUSES)[number];

export type BountyRequestListItem = {
  id: string;
  userId: string;
  title: string;
  category: string | null;
  itemName: string;
  player: string | null;
  setName: string | null;
  year: string | null;
  gradeCompany: string | null;
  gradeTarget: string | null;
  grade: string | null;
  condition: string | null;
  certNumber: string | null;
  priceMin: number | null;
  priceMax: number | null;
  bountyAmount: number | null;
  notes: string | null;
  imageUrl: string | null;
  status: BountyRequestStatus;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    username: string | null;
    displayName: string | null;
    image?: string | null;
  };
};

export type BountyRequestDetail = BountyRequestListItem & {
  savesCount?: number;
};

export type BountySortMode =
  | "newest"
  | "highest-bounty"
  | "highest-budget"
  | "most-specific"
  | "recently-active";

export type BountySearchSuggestion = {
  id: string;
  source: "listing" | "trade" | "bounty" | "cert";
  title: string;
  subtitle: string;
  imageUrl: string | null;
  category: string | null;
  itemName: string;
  player: string | null;
  setName: string | null;
  year: string | null;
  gradeCompany: string | null;
  gradeTarget: string | null;
  certNumber: string | null;
};

function formatCurrencyFromCents(value: number) {
  return `$${(value / 100).toLocaleString()}`;
}

function clean(value: string | null | undefined) {
  return value?.trim() || "";
}

export function bountyBudgetLabel(priceMin: number | null, priceMax: number | null) {
  if (priceMin !== null && priceMax !== null) {
    return `Budget ${formatCurrencyFromCents(priceMin)}-${formatCurrencyFromCents(priceMax)}`;
  }
  if (priceMin !== null) return `Budget from ${formatCurrencyFromCents(priceMin)}`;
  if (priceMax !== null) return `Budget up to ${formatCurrencyFromCents(priceMax)}`;
  return "Budget on request";
}

export function bountyBudgetValue(bounty: Pick<BountyRequestListItem, "priceMin" | "priceMax">) {
  return Math.max(bounty.priceMax ?? 0, bounty.priceMin ?? 0);
}

export function bountyAmountLabel(amount: number | null | undefined) {
  if (typeof amount !== "number" || amount <= 0) return "No bonus bounty";
  return `Bounty ${formatCurrencyFromCents(amount)}`;
}

export function bountySpecificityScore(
  bounty: Pick<
    BountyRequestListItem,
    | "player"
    | "setName"
    | "year"
    | "gradeCompany"
    | "gradeTarget"
    | "grade"
    | "condition"
    | "certNumber"
    | "notes"
    | "imageUrl"
    | "category"
  >,
) {
  let score = 0;
  if (bounty.player) score += 2;
  if (bounty.setName) score += 2;
  if (bounty.year) score += 1;
  if (bounty.gradeCompany) score += 2;
  if (bounty.gradeTarget || bounty.grade) score += 3;
  if (bounty.condition) score += 2;
  if (bounty.certNumber) score += 2;
  if (bounty.notes) score += 1;
  if (bounty.imageUrl) score += 1;
  if (bounty.category) score += 1;
  return score;
}

export function compactBountyMeta(
  bounty: Pick<
    BountyRequestListItem,
    "player" | "setName" | "year" | "gradeCompany" | "gradeTarget" | "grade" | "condition" | "certNumber" | "category"
  >,
) {
  const targetSummary = [clean(bounty.gradeCompany), clean(bounty.gradeTarget) || clean(bounty.grade)]
    .filter(Boolean)
    .join(" ")
    .trim();
  const itemSummary = [clean(bounty.year), clean(bounty.setName), clean(bounty.player)].filter(Boolean).join(" • ");
  const conditionSummary = clean(bounty.condition);
  const certSummary = clean(bounty.certNumber) ? `Cert ${clean(bounty.certNumber)}` : "";

  const parts = [targetSummary, itemSummary, conditionSummary, certSummary, clean(bounty.category)].filter(Boolean);
  return parts.slice(0, 3).join(" • ") || "Collector request";
}

export function compactBountyActivity(notes: string | null | undefined) {
  const trimmed = typeof notes === "string" ? notes.trim() : "";
  if (!trimmed) return "Open bounty";
  if (trimmed.length <= 48) return trimmed;
  return `${trimmed.slice(0, 45)}...`;
}

export function isBountyRequestStatus(value: unknown): value is BountyRequestStatus {
  return typeof value === "string" && BOUNTY_REQUEST_STATUSES.includes(value as BountyRequestStatus);
}
