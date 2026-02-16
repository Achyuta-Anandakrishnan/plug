import { UserRole, VerificationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isDev, jsonError, jsonOk, parseJson } from "@/lib/api";
import { notifySellerApplication } from "@/lib/email";
import { getSessionUser } from "@/lib/auth";

type ApplySellerBody = {
  userId?: string;
  email?: string;
  displayName?: string;
  phone?: string;
  notes?: string;
};

export async function POST(request: Request) {
  const body = await parseJson<ApplySellerBody>(request);
  if (!body) {
    return jsonError("Invalid request body.");
  }
  const sessionUser = await getSessionUser();
  const effectiveUserId = sessionUser?.id ?? (isDev() ? body?.userId : null);

  if (!effectiveUserId && !body?.email) {
    return jsonError("userId or email is required.");
  }

  const email = body.email?.trim().toLowerCase();
  if (email && !email.includes("@")) {
    return jsonError("Invalid email.");
  }

  const user =
    effectiveUserId
      ? await prisma.user.findUnique({ where: { id: effectiveUserId } })
      : email
        ? await prisma.user.findUnique({ where: { email } })
        : null;

  if (!user && !email) {
    return jsonError("User not found.", 404);
  }

  if (sessionUser && !isDev()) {
    const googleAccount = await prisma.account.findFirst({
      where: { userId: sessionUser.id, provider: "google" },
    });
    if (!googleAccount) {
      return jsonError("Seller verification requires Google sign-in.", 403);
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    const ensuredUser =
      user ??
      (await tx.user.create({
        data: {
          email,
          displayName: body.displayName?.trim(),
          name: body.displayName?.trim(),
          phone: body.phone?.trim(),
          role: UserRole.SELLER,
        },
      }));

    if (ensuredUser.role !== UserRole.SELLER) {
      await tx.user.update({
        where: { id: ensuredUser.id },
        data: { role: UserRole.SELLER },
      });
    }

    const seller = await tx.sellerProfile.upsert({
      where: { userId: ensuredUser.id },
      update: {
        status: "IN_REVIEW",
        manualNotes: body.notes?.trim(),
      },
      create: {
        userId: ensuredUser.id,
        status: "IN_REVIEW",
        manualNotes: body.notes?.trim(),
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
      data: steps.map((type) => ({
        sellerId: seller.id,
        type,
      })),
      skipDuplicates: true,
    });

    return { seller, user: ensuredUser };
  });

  await notifySellerApplication({
    sellerId: result.seller.id,
    email: result.user.email ?? email ?? "unknown",
    displayName: result.user.displayName ?? body.displayName ?? "New seller",
  });

  return jsonOk(result, { status: 201 });
}
