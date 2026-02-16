import { NextResponse } from "next/server";

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

export function getActorId(request: Request) {
  return request.headers.get("x-user-id");
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
