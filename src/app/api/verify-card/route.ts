import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk, parseJson } from "@/lib/api";
import { ensureVerifyCardSchema } from "@/lib/verify-card-schema";

type VerifyCardBody = {
  grader?: string;
  certNumber?: string;
};

type CardImages = {
  front: string | null;
  back: string | null;
};

type NormalizedCard = {
  found: boolean;
  grader: string;
  certNumber: string;
  verificationStatus: "verified" | "not_found";
  provider: string;
  player: string | null;
  year: string | null;
  brand: string | null;
  set: string | null;
  cardNumber: string | null;
  grade: string | null;
  title: string | null;
  images: CardImages;
  imageUrl: string | null;
  imageUrls: string[];
  label: string | null;
  subject: string | null;
  category: string | null;
  variety: string | null;
  note: string;
  source: "PSA_PUBLIC_API" | "LOOKUP_FALLBACK";
  cached?: boolean;
};

type PsaCertApiResponse = {
  PSACert?: {
    LabelType?: string | null;
    Year?: string | number | null;
    Brand?: string | null;
    Category?: string | null;
    CardNumber?: string | null;
    Subject?: string | null;
    Variety?: string | null;
    GradeDescription?: string | null;
    CardGrade?: string | null;
  } | null;
};

type PsaCertImageResponseItem = {
  IsFrontImage?: boolean;
  ImageURL?: string | null;
};

function asText(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getPsaApiToken() {
  return (
    process.env.PSA_PUBLIC_API_KEY?.trim()
    || process.env.PSA_API_KEY?.trim()
    || process.env.PSA_PUBLIC_API_TOKEN?.trim()
    || process.env.PSA_ACCESS_TOKEN?.trim()
    || ""
  );
}

function normalizePsaLabel(labelType: string | null) {
  if (!labelType) return null;
  const normalized = labelType.trim();
  if (!normalized) return null;
  if (normalized.toLowerCase() === "lighthouselabel") {
    return "w/ Fugitive Ink Technology";
  }
  return normalized;
}

function normalizeImageUrl(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^https?:\/\//i.test(trimmed)) return null;
  return trimmed;
}

function uniqueImageUrls(values: Array<string | null | undefined>) {
  const deduped = new Set<string>();
  for (const value of values) {
    const normalized = normalizeImageUrl(value);
    if (!normalized) continue;
    deduped.add(normalized);
  }
  return Array.from(deduped).slice(0, 8);
}

function coerceImageUrls(input: unknown, imageUrl?: string | null) {
  const urls: Array<string | null | undefined> = [imageUrl ?? null];

  if (Array.isArray(input)) {
    for (const entry of input) {
      if (typeof entry === "string") urls.push(entry);
    }
  } else if (input && typeof input === "object") {
    const maybeObj = input as { front?: unknown; back?: unknown };
    if (typeof maybeObj.front === "string") urls.push(maybeObj.front);
    if (typeof maybeObj.back === "string") urls.push(maybeObj.back);
  }

  return uniqueImageUrls(urls);
}

function buildTitleFromParts(card: {
  title?: string | null;
  year?: string | null;
  brand?: string | null;
  set?: string | null;
  cardNumber?: string | null;
  player?: string | null;
  subject?: string | null;
  variety?: string | null;
  grader?: string;
  certNumber?: string;
}) {
  const explicit = asText(card.title ?? null);
  if (explicit) return explicit;

  const effectiveBrand = asText(card.brand ?? card.set ?? null);
  const effectivePlayer = asText(card.player ?? card.subject ?? null);
  const parts = [
    asText(card.year ?? null),
    effectiveBrand,
    asText(card.cardNumber ? `#${card.cardNumber}` : null),
    effectivePlayer,
    asText(card.variety ?? null),
  ].filter((entry): entry is string => Boolean(entry));

  if (parts.length > 0) return parts.join(" ");
  return `${card.grader ?? "Graded"} cert ${card.certNumber ?? ""}`.trim();
}

function normalizeCard(input: Partial<NormalizedCard> & {
  found: boolean;
  grader: string;
  certNumber: string;
  note: string;
  source: NormalizedCard["source"];
}) {
  const imageUrls = coerceImageUrls(input.imageUrls ?? input.images, input.imageUrl);
  const images: CardImages = {
    front: imageUrls[0] ?? null,
    back: imageUrls[1] ?? null,
  };

  const brand = asText(input.brand ?? input.set ?? null);
  const set = asText(input.set ?? input.brand ?? null);
  const subject = asText(input.subject ?? input.player ?? null);
  const player = asText(input.player ?? input.subject ?? null);

  const normalized: NormalizedCard = {
    found: Boolean(input.found),
    grader: (input.grader || "PSA").toUpperCase(),
    certNumber: input.certNumber,
    verificationStatus: input.found ? "verified" : "not_found",
    provider: (input.provider || input.grader || "PSA").toString().toLowerCase(),
    player,
    year: asText(input.year ?? null),
    brand,
    set,
    cardNumber: asText(input.cardNumber ?? null),
    grade: asText(input.grade ?? null),
    title: buildTitleFromParts({
      title: asText(input.title ?? null),
      year: asText(input.year ?? null),
      brand,
      set,
      cardNumber: asText(input.cardNumber ?? null),
      player,
      subject,
      variety: asText(input.variety ?? null),
      grader: input.grader,
      certNumber: input.certNumber,
    }),
    images,
    imageUrl: images.front,
    imageUrls,
    label: asText(input.label ?? null),
    subject,
    category: asText(input.category ?? null),
    variety: asText(input.variety ?? null),
    note: input.note,
    source: input.source,
    cached: input.cached,
  };

  return normalized;
}

function emptyCard(grader: string, certNumber: string, note: string, source: NormalizedCard["source"]): NormalizedCard {
  return normalizeCard({
    found: false,
    grader,
    certNumber,
    note,
    source,
  });
}

async function fetchPsaCertImages(certNumber: string, token: string): Promise<string[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(
      `https://api.psacard.com/publicapi/cert/GetImagesByCertNumber/${encodeURIComponent(certNumber)}`,
      {
        signal: controller.signal,
        headers: {
          accept: "application/json",
          authorization: `bearer ${token}`,
          "user-agent": "DalowVerifyCard/1.0",
        },
        cache: "no-store",
      },
    );

    if (!response.ok) return [];
    const payload = (await response.json()) as PsaCertImageResponseItem[] | null;
    if (!Array.isArray(payload) || payload.length === 0) return [];

    const front = payload.find((entry) => entry.IsFrontImage)?.ImageURL ?? null;
    const back = payload.find((entry) => entry.IsFrontImage === false)?.ImageURL ?? null;
    const ordered = [
      front,
      back,
      ...payload.map((entry) => entry.ImageURL ?? null),
    ];
    return uniqueImageUrls(ordered);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

async function lookupViaPsaApi(certNumber: string): Promise<NormalizedCard> {
  const token = getPsaApiToken();
  if (!token) {
    return emptyCard("PSA", certNumber, "PSA API token missing.", "PSA_PUBLIC_API");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(
      `https://api.psacard.com/publicapi/cert/GetByCertNumber/${encodeURIComponent(certNumber)}`,
      {
        signal: controller.signal,
        headers: {
          accept: "application/json",
          authorization: `bearer ${token}`,
          "user-agent": "DalowVerifyCard/1.0",
        },
        cache: "no-store",
      },
    );

    if (response.status === 404) {
      return emptyCard("PSA", certNumber, "No PSA certificate match found.", "PSA_PUBLIC_API");
    }

    if (response.status === 401 || response.status === 403) {
      return emptyCard("PSA", certNumber, "PSA API token is invalid or expired.", "PSA_PUBLIC_API");
    }

    if (response.status === 429) {
      return emptyCard("PSA", certNumber, "PSA API daily quota reached.", "PSA_PUBLIC_API");
    }

    if (!response.ok) {
      return emptyCard("PSA", certNumber, "PSA API lookup unavailable right now.", "PSA_PUBLIC_API");
    }

    const payload = (await response.json()) as PsaCertApiResponse;
    const card = payload.PSACert;
    if (!card) {
      return emptyCard("PSA", certNumber, "No PSA certificate match found.", "PSA_PUBLIC_API");
    }

    const year = card.Year !== undefined && card.Year !== null ? String(card.Year) : null;
    const brand = asText(card.Brand);
    const subject = asText(card.Subject);
    const cardNumber = asText(card.CardNumber);
    const category = asText(card.Category);
    const variety = asText(card.Variety);
    const grade = asText(card.CardGrade) ?? asText(card.GradeDescription);
    const label = normalizePsaLabel(asText(card.LabelType));
    const imageUrls = grade ? await fetchPsaCertImages(certNumber, token) : [];

    return normalizeCard({
      found: Boolean(grade),
      grader: "PSA",
      certNumber,
      year,
      brand,
      set: brand,
      subject,
      player: subject,
      cardNumber,
      category,
      variety,
      grade,
      label,
      imageUrls,
      note: grade ? "Certificate matched via official PSA API." : "No PSA certificate match found.",
      source: "PSA_PUBLIC_API",
    });
  } catch {
    return emptyCard("PSA", certNumber, "PSA API lookup unavailable right now.", "PSA_PUBLIC_API");
  } finally {
    clearTimeout(timer);
  }
}

async function lookupViaFallback(grader: string, certNumber: string, origin: string): Promise<NormalizedCard> {
  const lookupUrl = new URL("/api/grading/lookup", origin);
  if (grader !== "AUTO") {
    lookupUrl.searchParams.set("company", grader);
  }
  lookupUrl.searchParams.set("cert", certNumber);

  const response = await fetch(lookupUrl.toString(), { cache: "no-store" });
  const payload = (await response.json()) as {
    found?: boolean;
    company?: string | null;
    grade?: string | null;
    label?: string | null;
    title?: string | null;
    year?: string | null;
    brand?: string | null;
    subject?: string | null;
    cardNumber?: string | null;
    category?: string | null;
    variety?: string | null;
    imageUrl?: string | null;
    images?: unknown;
    note?: string;
    error?: string;
  };

  const fallbackImageUrls = coerceImageUrls(payload.images, payload.imageUrl ?? null);

  return normalizeCard({
    found: Boolean(payload.found),
    grader: payload.company ?? grader,
    certNumber,
    title: payload.title ?? null,
    year: payload.year ?? null,
    brand: payload.brand ?? null,
    set: payload.brand ?? null,
    subject: payload.subject ?? null,
    player: payload.subject ?? null,
    cardNumber: payload.cardNumber ?? null,
    category: payload.category ?? null,
    variety: payload.variety ?? null,
    grade: payload.grade ?? null,
    label: payload.label ?? null,
    imageUrls: fallbackImageUrls,
    imageUrl: fallbackImageUrls[0] ?? null,
    note: payload.note || payload.error || "Lookup unavailable right now.",
    source: "LOOKUP_FALLBACK",
  });
}

function mergeCards(primary: NormalizedCard, secondary: NormalizedCard): NormalizedCard {
  const imageUrls = uniqueImageUrls([
    ...primary.imageUrls,
    ...secondary.imageUrls,
    primary.images.front,
    primary.images.back,
    secondary.images.front,
    secondary.images.back,
    primary.imageUrl,
    secondary.imageUrl,
  ]);

  return normalizeCard({
    found: primary.found || secondary.found,
    grader: primary.grader || secondary.grader,
    certNumber: primary.certNumber || secondary.certNumber,
    title: primary.title ?? secondary.title,
    grade: primary.grade ?? secondary.grade,
    label: primary.label ?? secondary.label,
    year: primary.year ?? secondary.year,
    brand: primary.brand ?? secondary.brand,
    set: primary.set ?? secondary.set,
    subject: primary.subject ?? secondary.subject,
    player: primary.player ?? secondary.player,
    cardNumber: primary.cardNumber ?? secondary.cardNumber,
    category: primary.category ?? secondary.category,
    variety: primary.variety ?? secondary.variety,
    imageUrls,
    note: primary.found ? primary.note : secondary.note || primary.note,
    source: primary.found ? primary.source : secondary.source,
  });
}

function hydrateCachedCard(raw: unknown, grader: string, certNumber: string): NormalizedCard | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Partial<NormalizedCard> & Record<string, unknown>;

  return normalizeCard({
    found: Boolean(value.found),
    grader: asText(value.grader) ?? grader,
    certNumber: asText(value.certNumber) ?? certNumber,
    title: asText(value.title),
    grade: asText(value.grade),
    label: asText(value.label),
    year: asText(value.year),
    brand: asText(value.brand),
    set: asText(value.set) ?? asText(value.brand),
    subject: asText(value.subject),
    player: asText(value.player) ?? asText(value.subject),
    cardNumber: asText(value.cardNumber),
    category: asText(value.category),
    variety: asText(value.variety),
    images: value.images,
    imageUrls: Array.isArray(value.imageUrls)
      ? value.imageUrls.filter((entry): entry is string => typeof entry === "string")
      : undefined,
    imageUrl: asText(value.imageUrl),
    note: asText(value.note) ?? "Lookup unavailable right now.",
    source: value.source === "PSA_PUBLIC_API" ? "PSA_PUBLIC_API" : "LOOKUP_FALLBACK",
    cached: Boolean(value.cached),
  });
}

export async function POST(request: Request) {
  const body = await parseJson<VerifyCardBody>(request);
  const grader = (body?.grader ?? "AUTO").trim().toUpperCase();
  const certNumber = (body?.certNumber ?? "").replace(/\s+/g, "").trim();

  if (!certNumber) {
    return jsonError("certNumber is required.", 400);
  }
  if (!/^[A-Za-z0-9-]{4,64}$/.test(certNumber)) {
    return jsonError("Invalid certNumber format.", 400);
  }

  if (!["AUTO", "PSA", "CGC", "BGS", "BVG"].includes(grader)) {
    return jsonError("Unsupported grader.", 400);
  }

  await ensureVerifyCardSchema().catch(() => null);

  const cached = await prisma.$queryRawUnsafe<Array<{ normalized: unknown }>>(
    `SELECT "normalized"
     FROM "VerifiedCardCache"
     WHERE "grader" = $1
       AND "certNumber" = $2
       AND "expiresAt" > NOW()
     LIMIT 1`,
    grader,
    certNumber,
  );

  const cachedCard = hydrateCachedCard(cached[0]?.normalized, grader, certNumber);
  if (cachedCard) {
    return jsonOk({
      ...cachedCard,
      cached: true,
    });
  }

  const origin = request.url;
  let normalized: NormalizedCard;

  if (grader === "PSA") {
    normalized = await lookupViaPsaApi(certNumber);
    if (!normalized.found || normalized.imageUrls.length === 0) {
      const fallback = await lookupViaFallback("PSA", certNumber, origin);
      normalized = mergeCards(normalized, fallback);
    }
  } else if (grader === "AUTO") {
    const psaResult = await lookupViaPsaApi(certNumber);
    if (psaResult.found) {
      normalized = psaResult;
      if (normalized.imageUrls.length === 0) {
        const fallback = await lookupViaFallback("PSA", certNumber, origin);
        normalized = mergeCards(normalized, fallback);
      }
    } else {
      const fallback = await lookupViaFallback("AUTO", certNumber, origin);
      normalized = fallback;
      if (fallback.grader === "PSA" && fallback.found) {
        normalized = mergeCards(psaResult, fallback);
      }
    }
  } else {
    normalized = await lookupViaFallback(grader, certNumber, origin);
  }

  const ttlMs = normalized.found ? 24 * 60 * 60 * 1000 : 15 * 60 * 1000;
  const expiresAt = new Date(Date.now() + ttlMs);

  await prisma.$executeRawUnsafe(
    `INSERT INTO "VerifiedCardCache"
      ("grader", "certNumber", "normalized", "sourcePayload", "verifiedAt", "expiresAt", "updatedAt")
     VALUES ($1, $2, $3::jsonb, $4::jsonb, NOW(), $5, NOW())
     ON CONFLICT ("grader", "certNumber")
     DO UPDATE SET
      "normalized" = EXCLUDED."normalized",
      "sourcePayload" = EXCLUDED."sourcePayload",
      "verifiedAt" = EXCLUDED."verifiedAt",
      "expiresAt" = EXCLUDED."expiresAt",
      "updatedAt" = NOW()`,
    grader,
    certNumber,
    JSON.stringify(normalized),
    JSON.stringify({ source: normalized.source }),
    expiresAt.toISOString(),
  );

  return jsonOk({
    ...normalized,
    cached: false,
  });
}
