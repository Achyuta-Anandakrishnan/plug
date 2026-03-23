import "server-only";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = global as unknown as { prisma?: PrismaClient };

function normalizePrismaUrl(rawUrl: string | undefined) {
  if (!rawUrl) return undefined;

  try {
    const url = new URL(rawUrl);
    const host = url.hostname.toLowerCase();
    const isSupabasePooler = host.includes("pooler.supabase.com");

    if (isSupabasePooler && !url.searchParams.has("connection_limit")) {
      url.searchParams.set("connection_limit", "1");
    }

    if (isSupabasePooler && !url.searchParams.has("pool_timeout")) {
      url.searchParams.set("pool_timeout", "30");
    }

    return url.toString();
  } catch {
    return rawUrl;
  }
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: process.env.DATABASE_URL
      ? {
          db: {
            url: normalizePrismaUrl(process.env.DATABASE_URL),
          },
        }
      : undefined,
    log: ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
