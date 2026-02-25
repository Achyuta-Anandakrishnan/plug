import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk, parseJson } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { ensureProfileSchema } from "@/lib/profile-schema";
import {
  generateUniqueUsername,
  isValidUsername,
  normalizeUsernameInput,
} from "@/lib/username";

type UpdateProfileBody = {
  username?: string;
  displayName?: string;
  bio?: string;
  image?: string;
};

function isSameUtcMonth(a: Date, b: Date) {
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth();
}

function cleanOptionalText(value: string | undefined, maxLength: number) {
  if (value === undefined) return undefined;
  const next = value.trim();
  if (!next) return null;
  return next.slice(0, maxLength);
}

export async function GET() {
  await ensureProfileSchema().catch(() => null);

  const sessionUser = await getSessionUser();
  if (!sessionUser?.id) return jsonError("Authentication required.", 401);

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: {
      id: true,
      email: true,
      role: true,
      username: true,
      displayName: true,
      bio: true,
      image: true,
      createdAt: true,
    },
  });

  if (!user) return jsonError("User not found.", 404);

  if (!user.username) {
    const seed =
      user.displayName
      ?? user.email?.split("@")[0]
      ?? `user_${user.id.slice(-6)}`;
    const generated = await generateUniqueUsername(prisma, seed, user.id);
    try {
      const updated = await prisma.user.update({
        where: { id: user.id },
        data: { username: generated },
        select: {
          id: true,
          email: true,
          role: true,
          username: true,
          displayName: true,
          bio: true,
          image: true,
          createdAt: true,
        },
      });
      return jsonOk(updated);
    } catch {
      // If a race condition updates username first, fall through and return fresh data.
    }
  }

  return jsonOk(user);
}

export async function PUT(request: Request) {
  await ensureProfileSchema().catch(() => null);

  const sessionUser = await getSessionUser();
  if (!sessionUser?.id) return jsonError("Authentication required.", 401);

  const body = await parseJson<UpdateProfileBody>(request);
  if (!body) return jsonError("Invalid request body.", 400);

  const currentUser = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: {
      id: true,
      username: true,
      usernameChangeCount: true,
      usernameChangePeriodStart: true,
    },
  });
  if (!currentUser) return jsonError("User not found.", 404);

  const data: {
    username?: string | null;
    displayName?: string | null;
    bio?: string | null;
    image?: string | null;
    usernameChangeCount?: number;
    usernameChangePeriodStart?: Date | null;
  } = {};

  if (body.username !== undefined) {
    const normalized = normalizeUsernameInput(body.username);
    if (!isValidUsername(normalized)) {
      return jsonError(
        "Username must be 3-24 chars and use only lowercase letters, numbers, or underscores.",
        400,
      );
    }
    if (normalized !== currentUser.username) {
      const existing = await prisma.user.findFirst({
        where: {
          username: normalized,
          id: { not: sessionUser.id },
        },
        select: { id: true },
      });
      if (existing) {
        return jsonError("username not available", 409);
      }

      const isFirstSet = !currentUser.username;
      if (!isFirstSet) {
        const now = new Date();
        const sameMonth = currentUser.usernameChangePeriodStart
          ? isSameUtcMonth(currentUser.usernameChangePeriodStart, now)
          : false;
        const usedThisMonth = sameMonth ? currentUser.usernameChangeCount : 0;
        if (usedThisMonth >= 2) {
          return jsonError("You can only change username twice a month.", 429);
        }

        data.usernameChangeCount = usedThisMonth + 1;
        data.usernameChangePeriodStart = sameMonth
          ? currentUser.usernameChangePeriodStart
          : now;
      }

      data.username = normalized;
    }
  }

  if (body.displayName !== undefined) {
    data.displayName = cleanOptionalText(body.displayName, 60);
  }

  if (body.bio !== undefined) {
    data.bio = cleanOptionalText(body.bio, 280);
  }

  if (body.image !== undefined) {
    const nextImage = body.image.trim();
    data.image = nextImage ? nextImage.slice(0, 2048) : null;
  }

  const updated = await prisma.user.update({
    where: { id: sessionUser.id },
    data,
    select: {
      id: true,
      email: true,
      role: true,
      username: true,
      displayName: true,
      bio: true,
      image: true,
      createdAt: true,
    },
  });

  return jsonOk(updated);
}
