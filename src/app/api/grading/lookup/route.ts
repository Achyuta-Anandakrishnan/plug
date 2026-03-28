import { jsonError, jsonOk } from "@/lib/api";
import { fetchPsaCertificateSnapshot } from "@/lib/psa-cert";

type LookupResult = {
  found: boolean;
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
  population?: number | null;
  popHigher?: number | null;
  language?: string | null;
  rarity?: string | null;
  attributes?: string | null;
  blocked?: boolean;
  note: string;
};

const PSA_SUCCESS_TTL_MS = 12 * 60 * 60 * 1000;
const PSA_FAILURE_TTL_MS = 3 * 60 * 1000;
const psaLookupCache = new Map<string, { expiresAt: number; result: LookupResult }>();

function sanitize(text: string) {
  return text.replace(/\s+/g, " ").trim();
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

function extractFirstMatch(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return sanitize(match[1]);
  }
  return null;
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

  const snapshot = await fetchPsaCertificateSnapshot({ certNumber: cert });
  const result: LookupResult = {
    found: snapshot.found,
    company: "PSA",
    grade: snapshot.grade,
    label: snapshot.label,
    title: snapshot.title,
    year: snapshot.year,
    brand: snapshot.brand,
    subject: snapshot.player,
    cardNumber: snapshot.cardNumber,
    category: snapshot.category,
    variety: snapshot.variety,
    population: snapshot.population,
    popHigher: snapshot.popHigher,
    language: snapshot.language,
    rarity: snapshot.rarity,
    attributes: snapshot.attributes,
    note: snapshot.note,
  };
  writePsaCache(cert, result);
  return result;
}

async function lookupCgc(cert: string): Promise<LookupResult> {
  const { html, blocked } = await fetchText(`https://www.cgccards.com/certlookup/${encodeURIComponent(cert)}/`);
  if (!html) {
    return {
      found: false,
      company: "CGC",
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
    return { found: false, company: "CGC", note: "No CGC certificate match found." };
  }

  return {
    found: true,
    company: "CGC",
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
      company: "BGS",
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
    return { found: false, company: "BGS", note: "No Beckett certificate match found." };
  }

  return {
    found: true,
    company: "BGS",
    grade,
    label,
    note: "Beckett certificate matched.",
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const company = (searchParams.get("company") ?? "").trim();
  const cert = (searchParams.get("cert") ?? "").trim();

  if (!cert) {
    return jsonError("cert is required.", 400);
  }

  const normalized = company.toUpperCase();

  if (!normalized) {
    const attempts = [
      await lookupPsa(cert),
      await lookupCgc(cert),
      await lookupBeckett(cert),
    ];
    const matched = attempts.find((entry) => entry.found);
    if (matched) return jsonOk(matched);
    const blocked = attempts.find((entry) => entry.blocked);
    if (blocked) return jsonOk(blocked);
    return jsonOk(attempts[0] ?? { found: false, note: "No certificate match found." });
  }

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
    company: normalized,
    note: `${company} cert lookup API is not wired yet. You can still enter grade manually.`,
  } satisfies LookupResult);
}
