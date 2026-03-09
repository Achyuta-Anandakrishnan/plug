import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { EMAIL_REGEX, jsonError, jsonOk, parseJson } from "@/lib/api";
import { ensureProfileSchema } from "@/lib/profile-schema";
import { generateUniqueUsername } from "@/lib/username";
import { signNativeAuthToken } from "@/lib/native-auth";

type NativeAuthBody = {
  email?: string;
  displayName?: string;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function POST(request: Request) {
  await ensureProfileSchema().catch(() => null);

  const body = await parseJson<NativeAuthBody>(request);
  const email = body?.email ? normalizeEmail(body.email) : "";
  if (!email || !EMAIL_REGEX.test(email)) {
    return jsonError("Valid email is required.", 400);
  }

  const displayName = body?.displayName?.trim() || email.split("@")[0] || "Collector";

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      displayName,
      name: displayName,
    },
    create: {
      email,
      displayName,
      name: displayName,
      role: UserRole.BUYER,
    },
    select: {
      id: true,
      email: true,
      role: true,
      username: true,
      displayName: true,
      image: true,
    },
  });

  let username = user.username;
  if (!username) {
    const generated = await generateUniqueUsername(prisma, displayName || email.split("@")[0], user.id);
    try {
      const updated = await prisma.user.update({
        where: { id: user.id },
        data: { username: generated },
        select: { username: true },
      });
      username = updated.username;
    } catch {
      // If a concurrent request generated username first, proceed without failing auth.
    }
  }

  const token = signNativeAuthToken({
    id: user.id,
    email: user.email,
    role: user.role,
  });

  return jsonOk({
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      username: username ?? null,
      displayName: user.displayName ?? null,
      image: user.image ?? null,
    },
  });
}
