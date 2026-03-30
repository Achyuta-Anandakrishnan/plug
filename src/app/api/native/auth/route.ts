import { createHash, randomInt } from "crypto";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { EMAIL_REGEX, jsonError, jsonOk, parseJson } from "@/lib/api";
import { isBlockedAccountStatus } from "@/lib/account-status";
import { ensureProfileSchema } from "@/lib/profile-schema";
import { generateUniqueUsername } from "@/lib/username";
import { sendEmail } from "@/lib/email";

type NativeAuthBody = {
  email?: string;
  displayName?: string;
};

const LOGIN_CODE_TTL_MS = 15 * 60 * 1000; // 15 minutes

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function hashCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
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
      emailVerified: true,
      role: true,
      accountStatus: true,
      username: true,
    },
  });

  if (isBlockedAccountStatus(user.accountStatus)) {
    return jsonError("This account is not active.", 403);
  }

  // Invalidate any prior unused codes for this user
  await prisma.nativeLoginCode.updateMany({
    where: { userId: user.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });

  // Generate a 6-digit OTP
  const code = randomInt(100000, 1000000).toString().padStart(6, "0");
  const codeHash = hashCode(code);
  const expiresAt = new Date(Date.now() + LOGIN_CODE_TTL_MS);

  await prisma.nativeLoginCode.create({
    data: {
      userId: user.id,
      email,
      codeHash,
      expiresAt,
    },
  });

  await sendEmail({
    to: email,
    subject: "Your dalow login code",
    text: [
      `Your dalow login code is: ${code}`,
      "",
      "This code expires in 15 minutes.",
      "If you did not request this, you can ignore this email.",
    ].join("\n"),
  }).catch(() => null);

  // Ensure username exists (non-blocking)
  if (!user.username) {
    const generated = await generateUniqueUsername(prisma, displayName || email.split("@")[0], user.id).catch(() => null);
    if (generated) {
      await prisma.user.update({
        where: { id: user.id },
        data: { username: generated },
      }).catch(() => null);
    }
  }

  return jsonOk({ requiresVerification: true, email }, { status: 202 });
}
