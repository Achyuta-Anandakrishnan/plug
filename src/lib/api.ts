import { NextResponse } from "next/server";

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const memoryRateLimits = new Map<string, RateLimitEntry>();

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function parseJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

export function jsonOk<T>(data: T, init: ResponseInit = {}) {
  return NextResponse.json(data, { status: 200, ...init });
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function getDevSellerId() {
  return process.env.DEV_SELLER_ID || null;
}

export function getDevBuyerId() {
  return process.env.DEV_BUYER_ID || null;
}

export function isDev() {
  return process.env.NODE_ENV !== "production";
}

export function getRequestIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwardedFor) return forwardedFor;
  return request.headers.get("x-real-ip") ?? "unknown";
}

export function checkRateLimit(key: string, maxRequests: number, windowMs: number) {
  const now = Date.now();
  const current = memoryRateLimits.get(key);

  if (!current || current.resetAt <= now) {
    memoryRateLimits.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (current.count >= maxRequests) {
    return false;
  }

  current.count += 1;
  return true;
}
