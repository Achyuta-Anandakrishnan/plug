export type TradeGameType = "checkers" | "chess" | "coin" | "poker";

export type TradePostListItem = {
  id: string;
  ownerId: string;
  title: string;
  description: string | null;
  category: string | null;
  cardSet: string | null;
  cardNumber: string | null;
  condition: string | null;
  gradeCompany: string | null;
  gradeLabel: string | null;
  lookingFor: string;
  preferredBrands: string | null;
  location: string | null;
  shippingMode: string | null;
  tags: unknown;
  valueMin: number | null;
  valueMax: number | null;
  status: "OPEN" | "PAUSED" | "MATCHED" | "CLOSED" | "ARCHIVED";
  createdAt: string;
  updatedAt: string;
  owner: {
    id: string;
    username: string | null;
    displayName: string | null;
    image?: string | null;
  };
  images: Array<{
    id: string;
    url: string;
    isPrimary: boolean;
  }>;
  _count: {
    offers: number;
  };
};

export type TradeOfferItem = {
  id: string;
  postId: string;
  proposerId: string;
  message: string | null;
  cashAdjustment: number;
  gameType: TradeGameType | null;
  gameTerms: string | null;
  gameTermsVersion: number | null;
  gameProposedById: string | null;
  gameOwnerAgreedAt: string | null;
  gameProposerAgreedAt: string | null;
  gameLockedAt: string | null;
  gameStartedAt: string | null;
  gameResolvedAt: string | null;
  gameWinnerId: string | null;
  status: "PENDING" | "ACCEPTED" | "DECLINED" | "WITHDRAWN" | "COUNTERED";
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
  proposer: {
    id: string;
    username: string | null;
    displayName: string | null;
    image?: string | null;
  };
  settlement: {
    id: string;
    payerId: string;
    payeeId: string;
    amount: number;
    currency: string;
    status: "REQUIRES_PAYMENT" | "PROCESSING" | "SUCCEEDED" | "FAILED" | "CANCELED";
    providerCheckoutSession: string | null;
    providerPaymentIntent: string | null;
    paidAt: string | null;
    payer: {
      id: string;
      username: string | null;
      displayName: string | null;
    };
    payee: {
      id: string;
      username: string | null;
      displayName: string | null;
    };
  } | null;
  cards: Array<{
    id: string;
    title: string;
    cardSet: string | null;
    cardNumber: string | null;
    condition: string | null;
    gradeCompany: string | null;
    gradeLabel: string | null;
    estimatedValue: number | null;
    imageUrl: string | null;
    notes: string | null;
  }>;
};

export type TradePostDetail = TradePostListItem & {
  offers: TradeOfferItem[];
  viewer: {
    isOwner: boolean;
    canOffer: boolean;
    canEdit: boolean;
  };
};

export function tradeValueLabel(valueMin: number | null, valueMax: number | null) {
  if (valueMin !== null && valueMax !== null) return `$${valueMin.toLocaleString()}-$${valueMax.toLocaleString()}`;
  if (valueMin !== null) return `From $${valueMin.toLocaleString()}`;
  if (valueMax !== null) return `Up to $${valueMax.toLocaleString()}`;
  return "Open value";
}

export function formatTradeDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function formatTradeDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function toTagArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
}

export function isValidImageUrl(value: string | null | undefined) {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return /^https?:\/\/[^\s]+$/i.test(trimmed);
}
