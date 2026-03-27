import "server-only";
import { createHmac, timingSafeEqual } from "crypto";

type NativeAuthPayload = {
  sub: string;
  email: string | null;
  role: string | null;
  accountStatus: string | null;
  exp: number;
  iat: number;
};

type NativeUserLike = {
  id: string;
  email?: string | null;
  role?: string | null;
  accountStatus?: string | null;
};

const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 30;

function getSecret() {
  const secret = process.env.NATIVE_AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("NATIVE_AUTH_SECRET or NEXTAUTH_SECRET must be set in production.");
    }
    return "dev-native-secret-change-me";
  }
  return secret;
}

function toBase64Url(input: string | Buffer) {
  return Buffer.from(input).toString("base64url");
}

function fromBase64Url(input: string) {
  return Buffer.from(input, "base64url").toString("utf8");
}

function signatureFor(encodedPayload: string) {
  return createHmac("sha256", getSecret()).update(encodedPayload).digest("base64url");
}

function secureEquals(a: string, b: string) {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

export function signNativeAuthToken(user: NativeUserLike, ttlSeconds = DEFAULT_TTL_SECONDS) {
  const now = Math.floor(Date.now() / 1000);
  const payload: NativeAuthPayload = {
    sub: user.id,
    email: user.email ?? null,
    role: user.role ?? null,
    accountStatus: user.accountStatus ?? null,
    iat: now,
    exp: now + Math.max(60, ttlSeconds),
  };

  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = signatureFor(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function verifyNativeAuthToken(token: string | null | undefined): NativeAuthPayload | null {
  if (!token) return null;
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;

  const expected = signatureFor(encodedPayload);
  if (!secureEquals(signature, expected)) {
    return null;
  }

  try {
    const parsed = JSON.parse(fromBase64Url(encodedPayload)) as Partial<NativeAuthPayload>;
    if (!parsed?.sub || typeof parsed.sub !== "string") return null;
    if (typeof parsed.exp !== "number") return null;
    if (parsed.exp <= Math.floor(Date.now() / 1000)) return null;

    return {
      sub: parsed.sub,
      email: typeof parsed.email === "string" ? parsed.email : null,
      role: typeof parsed.role === "string" ? parsed.role : null,
      accountStatus: typeof parsed.accountStatus === "string" ? parsed.accountStatus : null,
      exp: parsed.exp,
      iat: typeof parsed.iat === "number" ? parsed.iat : 0,
    };
  } catch {
    return null;
  }
}
