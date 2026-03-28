import "server-only";

import { fetchJustTcgMarketSnapshot, type JustTcgMarketSnapshot } from "@/lib/justtcg";

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

export type PsaCertificateSnapshot = {
  found: boolean;
  grader: "PSA";
  certNumber: string;
  grade: string | null;
  label: string | null;
  title: string | null;
  year: string | null;
  brand: string | null;
  setName: string | null;
  player: string | null;
  category: string | null;
  cardNumber: string | null;
  variety: string | null;
  language: string | null;
  rarity: string | null;
  attributes: string | null;
  itemDescription: string | null;
  population: number | null;
  popHigher: number | null;
  imageUrls: string[];
  images: {
    front: string | null;
    back: string | null;
  };
  marketData: JustTcgMarketSnapshot | null;
  note: string;
  source: "PSA_PUBLIC_API" | "PSA_CERT_PAGE";
};

const PSA_CERT_TIMEOUT_MS = 8000;

function asText(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeImageUrl(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || !/^https?:\/\//i.test(trimmed)) return null;
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

function sanitize(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function decodeHtmlEntities(text: string) {
  return text
    .replace(/&#x27;/gi, "'")
    .replace(/&quot;/gi, "\"")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function stripTags(text: string) {
  return decodeHtmlEntities(text.replace(/<[^>]+>/g, " "));
}

function extractDefinitionRows(html: string) {
  const rows: Record<string, string> = {};
  const rowPattern = /<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/gi;
  let match: RegExpExecArray | null;
  while ((match = rowPattern.exec(html))) {
    const key = sanitize(stripTags(match[1]).toLowerCase());
    const value = sanitize(stripTags(match[2]));
    if (!key || !value) continue;
    rows[key] = value;
  }
  return rows;
}

function parseCount(value: string | null | undefined) {
  if (!value) return null;
  const digits = value.replace(/[^\d]/g, "");
  if (!digits) return null;
  const parsed = Number(digits);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractFirstMatch(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return sanitize(match[1]);
  }
  return null;
}

async function fetchWithTimeout(url: string, timeoutMs = 5000, init?: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; DalowPsaLookup/1.0)",
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

async function fetchCertPageHtml(certNumber: string) {
  const url = `https://www.psacard.com/cert/${encodeURIComponent(certNumber)}`;
  const direct = await fetchWithTimeout(url, 5000);
  if (!direct) return null;
  if (direct.response.ok) return direct.text;
  const blocked = isChallengeResponse(direct.response.status, direct.text, direct.response.headers);
  if (!blocked) return null;
  return fetchViaScrapingBee(url);
}

async function fetchPsaCertImages(certNumber: string, token: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PSA_CERT_TIMEOUT_MS);
  try {
    const response = await fetch(
      `https://api.psacard.com/publicapi/cert/GetImagesByCertNumber/${encodeURIComponent(certNumber)}`,
      {
        signal: controller.signal,
        headers: {
          accept: "application/json",
          authorization: `bearer ${token}`,
          "user-agent": "DalowPsaLookup/1.0",
        },
        cache: "no-store",
      },
    );

    if (!response.ok) return [];
    const payload = (await response.json()) as PsaCertImageResponseItem[] | null;
    if (!Array.isArray(payload) || payload.length === 0) return [];

    const front = payload.find((entry) => entry.IsFrontImage)?.ImageURL ?? null;
    const back = payload.find((entry) => entry.IsFrontImage === false)?.ImageURL ?? null;
    return uniqueImageUrls([front, back, ...payload.map((entry) => entry.ImageURL ?? null)]);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

function buildTitle(parts: {
  year?: string | null;
  brand?: string | null;
  cardNumber?: string | null;
  player?: string | null;
  variety?: string | null;
}) {
  const values = [
    parts.year ?? null,
    parts.brand ?? null,
    parts.cardNumber ? `#${parts.cardNumber}` : null,
    parts.player ?? null,
    parts.variety ?? null,
  ].filter((value): value is string => Boolean(value));
  return values.length > 0 ? values.join(" ") : null;
}

function buildDescription(category: string | null, marketData: JustTcgMarketSnapshot | null) {
  if (marketData?.game === "pokemon") {
    return "Pokemon trading cards graded by PSA with verified certification and live market context";
  }
  if (marketData?.game === "mtg") {
    return "Magic: The Gathering graded card with verified certification and live market context";
  }
  if (category) {
    return `${category} graded card with verified certification`;
  }
  return null;
}

export async function fetchPsaCertificateSnapshot(input: {
  certNumber: string;
  itemName?: string | null;
  category?: string | null;
}) : Promise<PsaCertificateSnapshot> {
  const certNumber = input.certNumber.replace(/\s+/g, "").trim();
  const token = getPsaApiToken();

  let grade: string | null = null;
  let label: string | null = null;
  let year: string | null = null;
  let brand: string | null = null;
  let category: string | null = input.category?.trim() || null;
  let cardNumber: string | null = null;
  let player: string | null = null;
  let variety: string | null = null;
  let imageUrls: string[] = [];
  let note = "No PSA certificate match found.";
  let source: PsaCertificateSnapshot["source"] = "PSA_PUBLIC_API";

  if (token) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PSA_CERT_TIMEOUT_MS);
    try {
      const response = await fetch(
        `https://api.psacard.com/publicapi/cert/GetByCertNumber/${encodeURIComponent(certNumber)}`,
        {
          signal: controller.signal,
          headers: {
            accept: "application/json",
            authorization: `bearer ${token}`,
            "user-agent": "DalowPsaLookup/1.0",
          },
          cache: "no-store",
        },
      );

      if (response.ok) {
        const payload = (await response.json()) as PsaCertApiResponse;
        const cert = payload.PSACert;
        if (cert) {
          year = cert.Year !== undefined && cert.Year !== null ? String(cert.Year) : null;
          brand = asText(cert.Brand);
          category = asText(cert.Category) ?? category;
          cardNumber = asText(cert.CardNumber);
          player = asText(cert.Subject);
          variety = asText(cert.Variety);
          grade = asText(cert.CardGrade) ?? asText(cert.GradeDescription);
          label = normalizePsaLabel(asText(cert.LabelType));
          imageUrls = grade ? await fetchPsaCertImages(certNumber, token) : [];
          if (grade) {
            note = "Certificate matched via official PSA API.";
          }
        }
      }
    } catch {
      // Fall through to cert-page enrichment.
    } finally {
      clearTimeout(timer);
    }
  }

  let population: number | null = null;
  let popHigher: number | null = null;
  let language: string | null = null;
  let rarity: string | null = null;
  let attributes: string | null = null;

  const html = await fetchCertPageHtml(certNumber);
  if (html) {
    source = "PSA_CERT_PAGE";
    const rows = extractDefinitionRows(html);
    grade = grade ?? rows["item grade"] ?? extractFirstMatch(html, [/"grade"\s*:\s*"([^"]+)"/i]);
    year = year ?? rows.year ?? null;
    brand = brand ?? rows["brand/title"] ?? null;
    player = player ?? rows.subject ?? null;
    category = category ?? rows.category ?? null;
    cardNumber = cardNumber ?? rows["card number"] ?? null;
    variety = variety ?? rows["variety/pedigree"] ?? rows["variety\/pedigree"] ?? null;
    label = label ?? rows["label type"] ?? null;
    population = parseCount(rows["psa population"] ?? rows.population ?? extractFirstMatch(html, [/PSA Population<\/dt>\s*<dd[^>]*>([^<]+)/i]));
    popHigher = parseCount(rows["psa pop higher"] ?? rows["pop higher"] ?? extractFirstMatch(html, [/PSA Pop Higher<\/dt>\s*<dd[^>]*>([^<]+)/i]));
    language = rows.language ?? null;
    rarity = rows.rarity ?? null;
    attributes = rows.attributes ?? null;
    note = grade ? "Certificate matched via PSA cert page." : note;
  }

  const title = buildTitle({ year, brand, cardNumber, player, variety }) ?? input.itemName?.trim() ?? null;
  const marketData = title
    ? await fetchJustTcgMarketSnapshot({
        itemName: title,
        category,
      })
    : null;

  return {
    found: Boolean(grade),
    grader: "PSA",
    certNumber,
    grade,
    label,
    title,
    year,
    brand,
    setName: marketData?.setName ?? brand,
    player,
    category,
    cardNumber,
    variety,
    language: language ?? marketData?.language ?? null,
    rarity: rarity ?? marketData?.rarity ?? null,
    attributes: attributes ?? marketData?.printing ?? null,
    itemDescription: buildDescription(category, marketData),
    population,
    popHigher,
    imageUrls,
    images: {
      front: imageUrls[0] ?? null,
      back: imageUrls[1] ?? null,
    },
    marketData,
    note,
    source,
  };
}
