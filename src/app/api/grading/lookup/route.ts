import { jsonError, jsonOk } from "@/lib/api";

type LookupResult = {
  found: boolean;
  grade?: string | null;
  label?: string | null;
  title?: string | null;
  year?: string | null;
  brand?: string | null;
  subject?: string | null;
  cardNumber?: string | null;
  category?: string | null;
  variety?: string | null;
  blocked?: boolean;
  note: string;
};

type PsaCertApiResponse = {
  PSACert?: {
    CertNumber?: string;
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

const PSA_SUCCESS_TTL_MS = 12 * 60 * 60 * 1000;
const PSA_FAILURE_TTL_MS = 3 * 60 * 1000;
const psaLookupCache = new Map<string, { expiresAt: number; result: LookupResult }>();

function sanitize(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

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

function readPsaCache(cert: string) {
  const entry = psaLookupCache.get(cert);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    psaLookupCache.delete(cert);
    return null;
  }
  return entry.result;
}

function writePsaCache(cert: string, result: LookupResult) {
  const ttl = result.found ? PSA_SUCCESS_TTL_MS : PSA_FAILURE_TTL_MS;
  psaLookupCache.set(cert, {
    expiresAt: Date.now() + ttl,
    result,
  });
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

async function lookupPsaViaOfficialApi(cert: string): Promise<LookupResult | null> {
  const token = getPsaApiToken();
  if (!token) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(
      `https://api.psacard.com/publicapi/cert/GetByCertNumber/${encodeURIComponent(cert)}`,
      {
        signal: controller.signal,
        headers: {
          accept: "application/json",
          authorization: `bearer ${token}`,
          "user-agent": "DalowCertLookup/1.0",
        },
        cache: "no-store",
      },
    );

    if (response.status === 404) {
      return {
        found: false,
        note: "No PSA certificate match found.",
      };
    }

    if (response.status === 401 || response.status === 403) {
      return {
        found: false,
        note: "PSA API token is invalid or expired.",
      };
    }

    if (response.status === 429) {
      return {
        found: false,
        note: "PSA API daily quota reached. Lookup will use fallback sources.",
      };
    }

    if (!response.ok) {
      return {
        found: false,
        note: "PSA API lookup unavailable right now.",
      };
    }

    const payload = (await response.json()) as PsaCertApiResponse;
    const certData = payload.PSACert;
    if (!certData) {
      return {
        found: false,
        note: "No PSA certificate match found.",
      };
    }

    const year = certData.Year !== undefined && certData.Year !== null
      ? String(certData.Year)
      : null;
    const brand = asText(certData.Brand);
    const subject = asText(certData.Subject);
    const cardNumber = asText(certData.CardNumber);
    const category = asText(certData.Category);
    const variety = asText(certData.Variety);
    const grade = asText(certData.CardGrade) ?? asText(certData.GradeDescription);
    const label = normalizePsaLabel(asText(certData.LabelType));
    const title = [year, brand, cardNumber ? `#${cardNumber}` : null, subject, variety]
      .filter(Boolean)
      .join(" ");

    if (!grade) {
      return {
        found: false,
        note: "No PSA certificate match found.",
      };
    }

    return {
      found: true,
      grade,
      label,
      title: title || null,
      year,
      brand,
      subject,
      cardNumber,
      category,
      variety,
      note: "PSA certificate matched via official API.",
    };
  } catch {
    return {
      found: false,
      note: "PSA API lookup unavailable right now.",
    };
  } finally {
    clearTimeout(timer);
  }
}

function extractFirstMatch(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return sanitize(match[1]);
  }
  return null;
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

type FetchOutcome = {
  html: string | null;
  blocked: boolean;
};

function isChallengeResponse(status: number, body: string, headers: Headers) {
  if (headers.get("cf-mitigated") === "challenge") return true;
  if (status === 403 && /just a moment/i.test(body)) return true;
  return false;
}

async function fetchWithTimeout(url: string, timeoutMs = 5000, init?: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; DalowLookup/1.0)",
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
    headers: {
      accept: "text/html,application/xhtml+xml",
    },
  });

  if (!result || !result.response.ok) return null;
  return result.text;
}

async function fetchText(url: string): Promise<FetchOutcome> {
  const direct = await fetchWithTimeout(url);
  if (!direct) {
    return { html: null, blocked: false };
  }
  if (direct.response.ok) {
    return { html: direct.text, blocked: false };
  }

  const blocked = isChallengeResponse(direct.response.status, direct.text, direct.response.headers);
  if (!blocked) {
    return { html: null, blocked: false };
  }

  const proxied = await fetchViaScrapingBee(url);
  if (proxied) {
    return { html: proxied, blocked: false };
  }

  return { html: null, blocked: true };
}

async function lookupPsa(cert: string): Promise<LookupResult> {
  const cached = readPsaCache(cert);
  if (cached) return cached;

  const viaApi = await lookupPsaViaOfficialApi(cert);
  if (viaApi?.found) {
    writePsaCache(cert, viaApi);
    return viaApi;
  }

  const { html, blocked } = await fetchText(`https://www.psacard.com/cert/${encodeURIComponent(cert)}`);
  if (!html) {
    const result = {
      found: false,
      blocked,
      note: blocked
        ? viaApi?.note ?? "PSA blocked automated lookup. Add SCRAPINGBEE_API_KEY or official PSA API access."
        : viaApi?.note ?? "PSA lookup unavailable right now.",
    };
    writePsaCache(cert, result);
    return result;
  }

  const fields = extractDefinitionRows(html);
  const grade = fields["item grade"] ?? extractFirstMatch(html, [
    /"grade"\s*:\s*"([^"]+)"/i,
    /Grade<\/div>\s*<div[^>]*>([^<]+)</i,
  ]);
  const year = fields.year ?? null;
  const brand = fields["brand/title"] ?? null;
  const subject = fields.subject ?? null;
  const cardNumber = fields["card number"] ?? null;
  const category = fields.category ?? null;
  const variety = fields["variety\/pedigree"] ?? null;
  const label = fields["label type"] ?? null;
  const title = [year, brand, cardNumber ? `#${cardNumber}` : null, subject, variety]
    .filter(Boolean)
    .join(" ");

  if (!grade) {
    const result = { found: false, note: viaApi?.note ?? "No PSA certificate match found." };
    writePsaCache(cert, result);
    return result;
  }

  const result = {
    found: true,
    grade,
    label,
    title: title || null,
    year,
    brand,
    subject,
    cardNumber,
    category,
    variety,
    note: viaApi?.note?.includes("quota") ? "PSA certificate matched via fallback." : "PSA certificate matched.",
  };
  writePsaCache(cert, result);
  return result;
}

async function lookupCgc(cert: string): Promise<LookupResult> {
  const { html, blocked } = await fetchText(`https://www.cgccards.com/certlookup/${encodeURIComponent(cert)}/`);
  if (!html) {
    return {
      found: false,
      blocked,
      note: blocked
        ? "CGC blocked automated lookup. Add SCRAPINGBEE_API_KEY or official CGC API access."
        : "CGC lookup unavailable right now.",
    };
  }

  const grade = extractFirstMatch(html, [
    /"gradeString"\s*:\s*"([^"]+)"/i,
    /Grade\s*<\/[^>]+>\s*<[^>]+>([^<]+)</i,
  ]);
  const label = extractFirstMatch(html, [
    /"label"\s*:\s*"([^"]+)"/i,
    /(Pristine|Gold Label|Black Label)/i,
  ]);

  if (!grade) {
    return { found: false, note: "No CGC certificate match found." };
  }

  return {
    found: true,
    grade,
    label,
    note: "CGC certificate matched.",
  };
}

async function lookupBeckett(cert: string): Promise<LookupResult> {
  const { html, blocked } = await fetchText(
    `https://www.beckett.com/grading/card-lookup?item_id=${encodeURIComponent(cert)}&item_type=BGS`,
  );
  if (!html) {
    return {
      found: false,
      blocked,
      note: blocked
        ? "Beckett blocked automated lookup. Add SCRAPINGBEE_API_KEY or official Beckett API access."
        : "Beckett lookup unavailable right now.",
    };
  }

  const grade = extractFirstMatch(html, [
    /"final_grade"\s*:\s*"?([0-9.]+)"?/i,
    /Final Grade\s*<\/[^>]+>\s*<[^>]+>([^<]+)</i,
  ]);
  const label = extractFirstMatch(html, [/(Black Label|Gold Label)/i]);

  if (!grade) {
    return { found: false, note: "No Beckett certificate match found." };
  }

  return {
    found: true,
    grade,
    label,
    note: "Beckett certificate matched.",
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const company = (searchParams.get("company") ?? "").trim();
  const cert = (searchParams.get("cert") ?? "").trim();

  if (!company || !cert) {
    return jsonError("company and cert are required.", 400);
  }

  const normalized = company.toUpperCase();

  if (normalized === "PSA") {
    return jsonOk(await lookupPsa(cert));
  }
  if (normalized === "CGC") {
    return jsonOk(await lookupCgc(cert));
  }
  if (normalized === "BGS" || normalized === "BVG") {
    return jsonOk(await lookupBeckett(cert));
  }

  return jsonOk({
    found: false,
    note: `${company} cert lookup API is not wired yet. You can still enter grade manually.`,
  } satisfies LookupResult);
}
