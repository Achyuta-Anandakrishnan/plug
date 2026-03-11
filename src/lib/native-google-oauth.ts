import "server-only";
import { createHmac, timingSafeEqual } from "crypto";

export type GoogleNativeState = {
  redirectUri: string;
  nonce: string;
  exp: number;
};

export const DEFAULT_NATIVE_REDIRECT = "dalow://auth/native";

function getSecret() {
  return process.env.NATIVE_AUTH_SECRET || process.env.NEXTAUTH_SECRET || "dev-native-secret-change-me";
}

function toBase64Url(input: string | Buffer) {
  return Buffer.from(input).toString("base64url");
}

export function signGoogleNativeState(payload: GoogleNativeState) {
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = createHmac("sha256", getSecret()).update(encodedPayload).digest("base64url");
  return `${encodedPayload}.${signature}`;
}

function secureEquals(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function verifyGoogleNativeState(token: string | null) {
  if (!token) return null;
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;

  const expected = createHmac("sha256", getSecret()).update(encodedPayload).digest("base64url");
  if (!secureEquals(signature, expected)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as Partial<GoogleNativeState>;
    if (!parsed.redirectUri || typeof parsed.redirectUri !== "string") return null;
    if (!parsed.nonce || typeof parsed.nonce !== "string") return null;
    if (!parsed.exp || typeof parsed.exp !== "number") return null;
    if (parsed.exp <= Math.floor(Date.now() / 1000)) return null;
    return parsed as GoogleNativeState;
  } catch {
    return null;
  }
}

export function sanitizeNativeRedirectUri(value: string | null) {
  if (!value) return DEFAULT_NATIVE_REDIRECT;
  try {
    const url = new URL(value);
    if (url.protocol !== "dalow:") return DEFAULT_NATIVE_REDIRECT;
    if (!url.hostname || url.hostname !== "auth") return DEFAULT_NATIVE_REDIRECT;
    if (!url.pathname || url.pathname !== "/native") return DEFAULT_NATIVE_REDIRECT;
    return `${url.protocol}//${url.hostname}${url.pathname}`;
  } catch {
    return DEFAULT_NATIVE_REDIRECT;
  }
}

export function getAppOrigin(requestUrl?: string | URL) {
  if (requestUrl) {
    try {
      const parsed = requestUrl instanceof URL ? requestUrl : new URL(requestUrl);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        return parsed.origin.replace(/\/+$/g, "");
      }
    } catch {
      // Fall through to env-based origin.
    }
  }

  const raw = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "";
  if (!raw) return "";

  try {
    return new URL(raw).origin.replace(/\/+$/g, "");
  } catch {
    return raw.replace(/\/+$/g, "");
  }
}
