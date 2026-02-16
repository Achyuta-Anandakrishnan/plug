export function isMobileUserAgent(userAgent: string | null) {
  if (!userAgent) return false;
  return /Android|iPhone|iPad|iPod|Mobile|Silk|Kindle/i.test(userAgent);
}

