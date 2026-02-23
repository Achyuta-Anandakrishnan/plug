import { jsonError, jsonOk } from "@/lib/api";

type LookupResult = {
  found: boolean;
  grade?: string | null;
  label?: string | null;
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

async function fetchText(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; VyreLookup/1.0)",
      },
      cache: "no-store",
    });
    if (!response.ok) return null;
    return response.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function lookupPsa(cert: string): Promise<LookupResult> {
  const html = await fetchText(`https://www.psacard.com/cert/${encodeURIComponent(cert)}`);
  if (!html) {
    return { found: false, note: "PSA lookup unavailable right now." };
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
  const html = await fetchText(`https://www.cgccards.com/certlookup/${encodeURIComponent(cert)}/`);
  if (!html) {
    return { found: false, note: "CGC lookup unavailable right now." };
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
  const html = await fetchText(
    `https://www.beckett.com/grading/card-lookup?item_id=${encodeURIComponent(cert)}&item_type=BGS`,
  );
  if (!html) {
    return { found: false, note: "Beckett lookup unavailable right now." };
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
