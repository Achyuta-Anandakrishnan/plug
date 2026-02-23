import type { PrismaClient } from "@prisma/client";

export const USERNAME_REGEX = /^[a-z0-9_]{3,24}$/;

export function normalizeUsernameInput(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}

export function isValidUsername(value: string) {
  return USERNAME_REGEX.test(value);
}

export function usernameFromSeed(seed: string) {
  const normalized = normalizeUsernameInput(seed);
  if (normalized.length >= 3) return normalized.slice(0, 24);
  return `user_${normalized.padEnd(3, "0")}`.slice(0, 24);
}

export async function generateUniqueUsername(
  prisma: PrismaClient,
  seed: string,
  excludeUserId?: string,
) {
  const base = usernameFromSeed(seed);
  const taken = await prisma.user.findMany({
    where: {
      username: {
        startsWith: base,
      },
      ...(excludeUserId ? { id: { not: excludeUserId } } : undefined),
    },
    select: { username: true },
  });

  const used = new Set(
    taken
      .map((item) => item.username)
      .filter((entry): entry is string => Boolean(entry)),
  );

  if (!used.has(base)) return base;

  for (let i = 1; i <= 9999; i += 1) {
    const candidate = `${base}_${i}`.slice(0, 24);
    if (!used.has(candidate)) return candidate;
  }

  const fallback = `${base}_${Date.now().toString().slice(-4)}`.slice(0, 24);
  if (!used.has(fallback)) return fallback;
  return `user_${Math.random().toString(36).slice(2, 10)}`.slice(0, 24);
}
