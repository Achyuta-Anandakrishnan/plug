const BLUE_PLACEHOLDER_PATTERNS = ["/streams/stream-", "/streams/loop.mp4"] as const;

export function isBluePlaceholderMedia(url: string | null | undefined) {
  if (!url) return false;
  return BLUE_PLACEHOLDER_PATTERNS.some((pattern) => url.includes(pattern));
}

export function resolveDisplayMediaUrl(
  url: string | null | undefined,
  fallback = "/placeholders/pokemon-generic.svg",
) {
  if (!url || isBluePlaceholderMedia(url)) {
    return fallback;
  }
  return url;
}
