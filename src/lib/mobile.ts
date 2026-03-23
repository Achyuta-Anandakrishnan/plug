export function isProbablyMobileUserAgent(userAgent: string | null | undefined) {
  const value = userAgent ?? "";
  return /iphone|ipod|android.+mobile|mobile|blackberry|windows phone/i.test(value);
}
