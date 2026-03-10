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

async function lookupViaPsaApi(certNumber: string): Promise<NormalizedCard> {
  const token = getPsaApiToken();
  if (!token) {
    return {
      found: false,
      grader: "PSA",
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
      note: "PSA API token missing.",
      source: "PSA_PUBLIC_API",
    };
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
      return {
        found: false,
        grader: "PSA",
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
        note: "No PSA certificate match found.",
        source: "PSA_PUBLIC_API",
      };
    }

    if (response.status === 401 || response.status === 403) {
      return {
        found: false,
        grader: "PSA",
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
        note: "PSA API token is invalid or expired.",
        source: "PSA_PUBLIC_API",
      };
    }

    if (response.status === 429) {
      return {
        found: false,
        grader: "PSA",
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
        note: "PSA API daily quota reached.",
        source: "PSA_PUBLIC_API",
      };
    }

    if (!response.ok) {
      return {
        found: false,
        grader: "PSA",
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
        note: "PSA API lookup unavailable right now.",
        source: "PSA_PUBLIC_API",
      };
    }

    const payload = (await response.json()) as PsaCertApiResponse;
    const card = payload.PSACert;
    if (!card) {
      return {
        found: false,
        grader: "PSA",
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
        note: "No PSA certificate match found.",
        source: "PSA_PUBLIC_API",
      };
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
      note: grade ? "Certificate matched via official PSA API." : "No PSA certificate match found.",
      source: "PSA_PUBLIC_API",
    };
  } catch {
    return {
      found: false,
      grader: "PSA",
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
      note: "PSA API lookup unavailable right now.",
      source: "PSA_PUBLIC_API",
    };
  } finally {
    clearTimeout(timer);
  }
}

async function lookupViaFallback(grader: string, certNumber: string, origin: string): Promise<NormalizedCard> {
  const lookupUrl = new URL("/api/grading/lookup", origin);
  lookupUrl.searchParams.set("company", grader);
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
    note?: string;
    error?: string;
  };

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
    note: payload.note || payload.error || "Lookup unavailable right now.",
    source: "LOOKUP_FALLBACK",
  };
}

export async function POST(request: Request) {
  const body = await parseJson<VerifyCardBody>(request);
  const grader = (body?.grader ?? "PSA").trim().toUpperCase();
  const certNumber = (body?.certNumber ?? "").replace(/\s+/g, "").trim();

  if (!certNumber) {
    return jsonError("certNumber is required.", 400);
  }
  if (!/^[A-Za-z0-9-]{4,64}$/.test(certNumber)) {
    return jsonError("Invalid certNumber format.", 400);
  }

  if (!["PSA", "CGC", "BGS", "BVG"].includes(grader)) {
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
    if (!normalized.found && normalized.note.toLowerCase().includes("quota")) {
      normalized = await lookupViaFallback("PSA", certNumber, origin);
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
