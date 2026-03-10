const HTTP_ORIGIN_PATTERN = /^https?:\/\/[^/]+/i;

function normalizePath(path: string) {
  return path.startsWith("/") ? path : `/${path}`;
}

function trimTrailingSlashes(value: string) {
  return value.replace(/\/+$/g, "");
}

export function buildClientApiUrl(path: string) {
  const normalizedPath = normalizePath(path);

  if (typeof window !== "undefined") {
    const browserOrigin = window.location?.origin ?? "";
    if (HTTP_ORIGIN_PATTERN.test(browserOrigin)) {
      return `${trimTrailingSlashes(browserOrigin)}${normalizedPath}`;
    }
  }

  const appOrigin = process.env.NEXT_PUBLIC_APP_URL ?? "";
  if (HTTP_ORIGIN_PATTERN.test(appOrigin)) {
    return `${trimTrailingSlashes(appOrigin)}${normalizedPath}`;
  }

  return normalizedPath;
}

export async function fetchClientApi(path: string, init?: RequestInit) {
  const normalizedPath = normalizePath(path);
  const preferred = buildClientApiUrl(path);

  try {
    return await fetch(preferred, init);
  } catch {
    if (preferred !== normalizedPath) {
      return fetch(normalizedPath, init);
    }
    throw new Error("Unable to reach the service.");
  }
}

export function normalizeClientError(error: unknown, fallbackMessage: string) {
  if (!(error instanceof Error)) return fallbackMessage;
  const message = error.message.trim();
  if (!message) return fallbackMessage;
  if (/expected pattern/i.test(message)) return fallbackMessage;
  if (/unable to reach the service/i.test(message)) return fallbackMessage;
  return message;
}
