import { jsonError, jsonOk } from "@/lib/api";

type LookupResult = {
  found: boolean;
  grade?: string | null;
  label?: string | null;
  blocked?: boolean;
  note: string;
};

function sanitize(text: string) {
  return text.replace(/\s+/g, " ").trim();
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

async function fetchWithTimeout(url: string, init?: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
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

  const result = await fetchWithTimeout(target.toString(), {
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
  const { html, blocked } = await fetchText(`https://www.psacard.com/cert/${encodeURIComponent(cert)}`);
  if (!html) {
    return {
      found: false,
      blocked,
      note: blocked
        ? "PSA blocked automated lookup. Add SCRAPINGBEE_API_KEY or official PSA API access."
        : "PSA lookup unavailable right now.",
    };
  }

  const grade = extractFirstMatch(html, [
    /"grade"\s*:\s*"([^"]+)"/i,
    /Grade<\/div>\s*<div[^>]*>([^<]+)</i,
  ]);

  if (!grade) {
    return { found: false, note: "No PSA certificate match found." };
  }

  return {
    found: true,
    grade,
    note: "PSA certificate matched.",
  };
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
