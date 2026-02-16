import { prisma } from "@/lib/prisma";
import { isDev, jsonError, jsonOk, parseJson } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";

type ReferralBody = {
  referrerId?: string;
  referredEmail?: string;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function POST(request: Request) {
  const body = await parseJson<ReferralBody>(request);

  const sessionUser = await getSessionUser();
  if (!sessionUser && !isDev()) {
    return jsonError("Authentication required.", 401);
  }

  const referrerId =
    sessionUser?.id ?? (isDev() ? body?.referrerId : null);

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

  const referral = await prisma.referral.create({
    data: {
      referrerId,
      referredEmail: email,
    },
  });

  return jsonOk(referral, { status: 201 });
}
