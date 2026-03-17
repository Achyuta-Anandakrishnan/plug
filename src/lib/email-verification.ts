import "server-only";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

const EMAIL_VERIFICATION_TTL_MS = 1000 * 60 * 60 * 24 * 2;

function getAppOrigin() {
  return process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";
}

export function buildEmailVerificationUrl(token: string) {
  return `${getAppOrigin().replace(/\/+$/g, "")}/verify-email?token=${encodeURIComponent(token)}`;
}

export async function sendVerificationEmailForUser({
  userId,
  email,
}: {
  userId: string;
  email: string;
}) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return false;

  await prisma.emailVerificationToken.deleteMany({
    where: {
      userId,
      email: normalizedEmail,
      consumedAt: null,
    },
  });

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS);

  await prisma.emailVerificationToken.create({
    data: {
      userId,
      email: normalizedEmail,
      token,
      expiresAt,
    },
  });

  return sendEmail({
    to: normalizedEmail,
    subject: "Verify your dalow email",
    text: [
      "Verify your email to complete your dalow account.",
      "",
      `Open this link: ${buildEmailVerificationUrl(token)}`,
      "",
      "This link expires in 48 hours.",
    ].join("\n"),
  });
}

export async function consumeEmailVerificationToken(token: string) {
  const normalizedToken = token.trim();
  if (!normalizedToken) {
    return { ok: false as const, error: "Missing verification token." };
  }

  const record = await prisma.emailVerificationToken.findUnique({
    where: { token: normalizedToken },
    include: {
      user: {
        select: {
          id: true,
          email: true,
        },
      },
    },
  });

  if (!record || record.consumedAt) {
    return { ok: false as const, error: "This verification link is invalid or already used." };
  }

  if (record.expiresAt <= new Date()) {
    await prisma.emailVerificationToken.delete({ where: { token: normalizedToken } }).catch(() => null);
    return { ok: false as const, error: "This verification link has expired." };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { emailVerified: new Date() },
    }),
    prisma.emailVerificationToken.update({
      where: { token: normalizedToken },
      data: { consumedAt: new Date() },
    }),
  ]);

  return {
    ok: true as const,
    email: record.email,
    userId: record.userId,
  };
}
