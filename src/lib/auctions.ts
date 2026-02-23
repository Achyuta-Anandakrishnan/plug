import type { AuctionListItem } from "@/hooks/useAuctions";

type AuctionLike = {
  endTime: string | null;
  extendedTime: string | null;
};

export function getPrimaryImageUrl(auction: AuctionListItem) {
  const images = auction.item?.images ?? [];
  const primary = images.find((img) => img.isPrimary) ?? images[0];
  return primary?.url ?? null;
}

export function getTimeLeftSeconds(auction: AuctionLike) {
  const now = Date.now();
  const endTime = auction.extendedTime ?? auction.endTime;
  if (!endTime) return 0;
  const diff = new Date(endTime).getTime() - now;
  return Math.max(0, Math.floor(diff / 1000));
}

export function getGradeLabel(attributes: Record<string, unknown> | null | undefined) {
  if (!attributes) return null;
  const isGraded = attributes.isGraded === true;
  if (!isGraded) return null;

  const company = typeof attributes.gradingCompany === "string"
    ? attributes.gradingCompany.trim()
    : "";
  const grade = typeof attributes.grade === "string" ? attributes.grade.trim() : "";
  const label = typeof attributes.gradingLabel === "string"
    ? attributes.gradingLabel.trim()
    : "";
  const cert = typeof attributes.certNumber === "string"
    ? attributes.certNumber.trim()
    : "";

  const core = [company, grade, label].filter(Boolean).join(" ");
  if (!core && !cert) return "Graded";
  if (!cert) return core;
  return `${core || "Graded"} • Cert ${cert}`;
}
