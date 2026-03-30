import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { signNativeAuthToken } from "@/lib/native-auth";
import { EMAIL_REGEX, jsonError, jsonOk, parseJson } from "@/lib/api";
import { isBlockedAccountStatus } from "@/lib/account-status";

type VerifyBody = {
  email?: string;
  code?: string;
};

const MAX_ATTEMPTS = 5;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function hashCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

export async function POST(request: Request) {
  const body = await parseJson<VerifyBody>(request);
  const email = body?.email ? normalizeEmail(body.email) : "";
  const code = body?.code?.trim().replace(/\s/g, "") ?? "";

  if (!email || !EMAIL_REGEX.test(email)) {
    return jsonError("Valid email is required.", 400);
  }
  if (!code || !/^\d{6}$/.test(code)) {
    return jsonError("Valid 6-digit code is required.", 400);
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      displayName: true,
      role: true,
      accountStatus: true,
      username: true,
    },
  });

  if (!user) {
    return jsonError("Invalid code.", 400);
  }

  if (isBlockedAccountStatus(user.accountStatus)) {
    return jsonError("This account is not active.", 403);
  }

  const loginCode = await prisma.nativeLoginCode.findFirst({
    where: {
      userId: user.id,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!loginCode) {
    return jsonError("Invalid or expired code.", 400);
  }

  // Increment attempt counter and check limit
  if (loginCode.attempts >= MAX_ATTEMPTS) {
    await prisma.nativeLoginCode.update({
      where: { id: loginCode.id },
      data: { consumedAt: new Date() },
    });
    return jsonError("Too many attempts. Request a new code.", 400);
  }

  const expectedHash = hashCode(code);
  if (expectedHash !== loginCode.codeHash) {
    await prisma.nativeLoginCode.update({
      where: { id: loginCode.id },
      data: { attempts: { increment: 1 } },
    });
    const attemptsLeft = MAX_ATTEMPTS - loginCode.attempts - 1;
    return jsonError(`Invalid code. ${attemptsLeft} attempt${attemptsLeft === 1 ? "" : "s"} remaining.`, 400);
  }

  // Valid code — consume it and mark email verified
  await prisma.$transaction([
    prisma.nativeLoginCode.update({
      where: { id: loginCode.id },
      data: { consumedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: new Date() },
    }),
  ]);

  const token = signNativeAuthToken({
    id: user.id,
    email: user.email ?? email,
    role: user.role,
  });

  return jsonOk({ token, userId: user.id });
}
