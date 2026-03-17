import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk, parseJson } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";

type ReferralBody = {
  referredEmail?: string;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function POST(request: Request) {
  const body = await parseJson<ReferralBody>(request);

  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return jsonError("Authentication required.", 401);
  }

  const referrerId = sessionUser.id;

  if (!body?.referredEmail) {
    return jsonError("referredEmail is required.");
  }

  if (!referrerId) {
    return jsonError("referrerId is required.", 401);
  }

  const email = normalizeEmail(body.referredEmail);
  if (!email.includes("@")) {
    return jsonError("Invalid referredEmail.");
  }

  const referrer = await prisma.user.findUnique({
    where: { id: referrerId },
  });

  if (!referrer) {
    return jsonError("Referrer not found.", 404);
  }

  const existing = await prisma.referral.findFirst({
    where: {
      referrerId,
      referredEmail: email,
    },
  });

  const referral = existing
    ? await prisma.referral.update({
        where: { id: existing.id },
        data: {},
      })
    : await prisma.referral.create({
        data: {
          referrerId,
          referredEmail: email,
        },
      });

  return jsonOk(referral, { status: 201 });
}

export async function GET() {
  const sessionUser = await getSessionUser();
  if (!sessionUser?.id) {
    return jsonError("Authentication required.", 401);
  }

  const [profile, referrals] = await Promise.all([
    prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: {
        id: true,
        username: true,
        email: true,
      },
    }),
    prisma.referral.findMany({
      where: { referrerId: sessionUser.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        referredEmail: true,
        status: true,
        createdAt: true,
        approvedAt: true,
      },
    }),
  ]);

  return jsonOk({
    code: profile?.username ?? profile?.email ?? profile?.id ?? sessionUser.id,
    referrals,
  });
}
