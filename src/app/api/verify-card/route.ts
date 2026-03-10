import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk, parseJson } from "@/lib/api";
import { ensureVerifyCardSchema } from "@/lib/verify-card-schema";

type VerifyCardBody = {
  grader?: string;
  certNumber?: string;
};

type NormalizedCard = {
  found: boolean;
  grader: string;
  certNumber: string;
  title: string | null;
  grade: string | null;
  label: string | null;
  year: string | null;
  brand: string | null;
  subject: string | null;
  cardNumber: string | null;
  category: string | null;
  variety: string | null;
  imageUrl: string | null;
  images: string[];
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

function emptyCard(grader: string, certNumber: string, note: string, source: NormalizedCard["source"]): NormalizedCard {
  return {
    found: false,
    grader,
    certNumber,
    title: null,
    grade: null,
    label: null,
    year: null,
    brand: null,
    subject: null,
    cardNumber: null,
    category: null,
    variety: null,
    imageUrl: null,
    images: [],
    note,
    source,
  };
}

async function fetchWithTimeout(url: string, timeoutMs = 7000, init?: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; DalowVerifyCard/1.0)",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
    const text = await response.text();
    return { response, text };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function isChallengeResponse(status: number, body: string, headers: Headers) {
  if (headers.get("cf-mitigated") === "challenge") return true;
  if (status === 403 && /just a moment/i.test(body)) return true;
  return false;
}

async function fetchViaScrapingBee(url: string) {
  const apiKey = process.env.SCRAPINGBEE_API_KEY?.trim();
  if (!apiKey) return null;

  const target = new URL("https://app.scrapingbee.com/api/v1/");
  target.searchParams.set("api_key", apiKey);
  target.searchParams.set("url", url);
  target.searchParams.set("render_js", "false");
  target.searchParams.set("premium_proxy", "true");
  target.searchParams.set("country_code", "us");

  const result = await fetchWithTimeout(target.toString(), 20000, {
    headers: { accept: "text/html,application/xhtml+xml" },
  });

  if (!result || !result.response.ok) return null;
  return result.text;
}

function extractPsaImageCandidates(html: string, certNumber: string) {
  const certPath = `/cert/${encodeURIComponent(certNumber)}/`;
  const imageMatches = html.match(/https?:\/\/[^"\s>]+\.(?:jpg|jpeg|png|webp)/ig) ?? [];

  const certScoped = imageMatches.filter((entry) => entry.includes(certPath));
  const fallbackScoped = imageMatches.filter((entry) => !/meta\.jpg/i.test(entry));
  const urls = uniqueImageUrls(certScoped.length > 0 ? certScoped : fallbackScoped);

  return urls;
}

async function fetchPsaCertImages(certNumber: string): Promise<string[]> {
  const certUrl = `https://www.psacard.com/cert/${encodeURIComponent(certNumber)}`;
  const direct = await fetchWithTimeout(certUrl, 7000);

  if (direct?.response.ok) {
    const urls = extractPsaImageCandidates(direct.text, certNumber);
    if (urls.length > 0) return urls;
  }

  if (direct && !isChallengeResponse(direct.response.status, direct.text, direct.response.headers)) {
    return [];
  }

  const proxiedHtml = await fetchViaScrapingBee(certUrl);
  if (!proxiedHtml) return [];
  return extractPsaImageCandidates(proxiedHtml, certNumber);
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
    const title = [year, brand, cardNumber ? `#${cardNumber}` : null, subject, variety]
      .filter(Boolean)
      .join(" ");

    const images = grade ? await fetchPsaCertImages(certNumber) : [];

    return {
      found: Boolean(grade),
      grader: "PSA",
      certNumber,
      title: title || null,
      grade: grade ?? null,
      label,
      year,
      brand,
      subject,
      cardNumber,
      category,
      variety,
      imageUrl: images[0] ?? null,
      images,
      note: grade ? "Certificate matched via official PSA API." : "No PSA certificate match found.",
      source: "PSA_PUBLIC_API",
    };
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

  const fallbackImages = Array.isArray(payload.images)
    ? payload.images.filter((entry): entry is string => typeof entry === "string")
    : [];

  return {
    found: Boolean(payload.found),
    grader: payload.company ?? grader,
    certNumber,
    title: payload.title ?? null,
    grade: payload.grade ?? null,
    label: payload.label ?? null,
    year: payload.year ?? null,
    brand: payload.brand ?? null,
    subject: payload.subject ?? null,
    cardNumber: payload.cardNumber ?? null,
    category: payload.category ?? null,
    variety: payload.variety ?? null,
    imageUrl: normalizeImageUrl(payload.imageUrl) ?? normalizeImageUrl(fallbackImages[0]) ?? null,
    images: uniqueImageUrls(fallbackImages),
    note: payload.note || payload.error || "Lookup unavailable right now.",
    source: "LOOKUP_FALLBACK",
  };
}

function mergeCards(primary: NormalizedCard, secondary: NormalizedCard): NormalizedCard {
  const images = uniqueImageUrls([...(primary.images ?? []), ...(secondary.images ?? []), primary.imageUrl, secondary.imageUrl]);

  return {
    ...primary,
    found: primary.found || secondary.found,
    grader: primary.grader || secondary.grader,
    title: primary.title ?? secondary.title,
    grade: primary.grade ?? secondary.grade,
    label: primary.label ?? secondary.label,
    year: primary.year ?? secondary.year,
    brand: primary.brand ?? secondary.brand,
    subject: primary.subject ?? secondary.subject,
    cardNumber: primary.cardNumber ?? secondary.cardNumber,
    category: primary.category ?? secondary.category,
    variety: primary.variety ?? secondary.variety,
    imageUrl: primary.imageUrl ?? secondary.imageUrl ?? images[0] ?? null,
    images,
    note: primary.found ? primary.note : secondary.note || primary.note,
  };
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

  const cachedCard = cached[0]?.normalized as NormalizedCard | undefined;
  if (cachedCard) {
    return jsonOk({
      ...cachedCard,
      cached: true,
    } satisfies NormalizedCard);
  }

  const origin = request.url;
  let normalized: NormalizedCard;

  if (grader === "PSA") {
    normalized = await lookupViaPsaApi(certNumber);
    if (!normalized.found || normalized.images.length === 0) {
      const fallback = await lookupViaFallback("PSA", certNumber, origin);
      normalized = mergeCards(normalized, fallback);
    }
  } else if (grader === "AUTO") {
    const psaResult = await lookupViaPsaApi(certNumber);
    if (psaResult.found) {
      normalized = psaResult;
      if (normalized.images.length === 0) {
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
  } satisfies NormalizedCard);
}
