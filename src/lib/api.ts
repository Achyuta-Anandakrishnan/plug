import { NextResponse } from "next/server";

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const memoryRateLimits = new Map<string, RateLimitEntry>();
const upstashUrl = process.env.UPSTASH_REDIS_REST_URL?.trim() ?? "";
const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim() ?? "";

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

export function getRequestIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwardedFor) return forwardedFor;
  return request.headers.get("x-real-ip") ?? "unknown";
}

async function checkRateLimitMemory(key: string, maxRequests: number, windowMs: number) {
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

async function checkRateLimitUpstash(key: string, maxRequests: number, windowMs: number) {
  const bucket = Math.floor(Date.now() / windowMs);
  const redisKey = `ratelimit:${key}:${bucket}`;
  const expireSeconds = Math.max(1, Math.ceil(windowMs / 1000));

  const response = await fetch(`${upstashUrl}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${upstashToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      ["INCR", redisKey],
      ["EXPIRE", redisKey, String(expireSeconds)],
    ]),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("UPSTASH_RATE_LIMIT_FAILED");
  }

  const payload = (await response.json()) as Array<{ result?: number | string }>;
  const count = Number(payload?.[0]?.result ?? 0);
  if (!Number.isFinite(count) || count <= 0) {
    throw new Error("UPSTASH_RATE_LIMIT_INVALID");
  }

  return count <= maxRequests;
}

export async function checkRateLimit(key: string, maxRequests: number, windowMs: number) {
  if (upstashUrl && upstashToken) {
    try {
      return await checkRateLimitUpstash(key, maxRequests, windowMs);
    } catch {
      // Fall back to process memory when Redis is unavailable.
    }
  }

  return checkRateLimitMemory(key, maxRequests, windowMs);
}
