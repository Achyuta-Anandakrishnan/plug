import { VerificationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getRequestIp, jsonError, jsonOk, parseJson } from "@/lib/api";
import { notifySellerApplication } from "@/lib/email";
import { getSessionUser } from "@/lib/auth";

type ApplySellerBody = {
  displayName?: string;
  phone?: string;
  businessName?: string;
  inventorySummary?: string;
  streamExperience?: string;
  socialHandle?: string;
  website?: string;
  notes?: string;
  agreeToTerms?: boolean;
};

export async function POST(request: Request) {
  const body = await parseJson<ApplySellerBody>(request);
  if (!body) {
    return jsonError("Invalid request body.");
  }

  const sessionUser = await getSessionUser();
  if (!sessionUser?.id || !sessionUser?.email) {
    return jsonError("Authentication required.", 401);
  }

  const googleAccount = await prisma.account.findFirst({
    where: { userId: sessionUser.id, provider: "google" },
  });
  if (!googleAccount) {
    return jsonError("Seller verification requires Google sign-in.", 403);
  }

  const ip = getRequestIp(request);
  const rateLimitKey = `seller-apply:user:${sessionUser.id}:ip:${ip}`;
  if (!checkRateLimit(rateLimitKey, 3, 60_000)) {
    return jsonError("Too many seller application attempts. Try again shortly.", 429);
  }

  const displayName = body.displayName?.trim() || sessionUser.email.split("@")[0];
  const businessName = body.businessName?.trim() ?? "";
  const inventorySummary = body.inventorySummary?.trim() ?? "";
  const streamExperience = body.streamExperience?.trim() ?? "";

  if (businessName.length < 2) {
    return jsonError("Business name is required (min 2 characters).", 400);
  }
  if (inventorySummary.length < 20) {
    return jsonError("Inventory summary must be at least 20 characters.", 400);
  }
  if (streamExperience.length < 10) {
    return jsonError("Stream experience must be at least 10 characters.", 400);
  }
  if (!body.agreeToTerms) {
    return jsonError("You must agree to seller verification terms.", 400);
  }

  const result = await prisma.$transaction(async (tx) => {
    const ensuredUser = await tx.user.update({
      where: { id: sessionUser.id },
      data: {
        displayName,
        name: displayName,
        phone: body.phone?.trim() || undefined,
      },
    });

    const manualNotes = [
      `business=${businessName}`,
      body.socialHandle?.trim() ? `social=${body.socialHandle.trim()}` : null,
      body.website?.trim() ? `website=${body.website.trim()}` : null,
      `inventory=${inventorySummary}`,
      `stream=${streamExperience}`,
      body.notes?.trim() ? `notes=${body.notes.trim()}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const seller = await tx.sellerProfile.upsert({
      where: { userId: ensuredUser.id },
      update: {
        status: "IN_REVIEW",
        manualNotes,
      },
      create: {
        userId: ensuredUser.id,
        status: "IN_REVIEW",
        manualNotes,
      },
    });

    const steps = [
      VerificationType.IDENTITY,
      VerificationType.INVENTORY,
      VerificationType.INTERVIEW,
      VerificationType.PAYMENT,
      VerificationType.STREAM_QUALITY,
    ];

    await tx.verificationCheck.createMany({
      data: steps.map((type) => ({ sellerId: seller.id, type })),
      skipDuplicates: true,
    });

    return { seller, user: ensuredUser };
  });

  await notifySellerApplication({
    sellerId: result.seller.id,
    email: result.user.email ?? sessionUser.email,
    displayName: result.user.displayName ?? displayName,
  });

  return jsonOk(result, { status: 201 });
}
