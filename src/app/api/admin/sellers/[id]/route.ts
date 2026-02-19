import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk, parseJson } from "@/lib/api";
import { requireAdmin } from "@/lib/admin";
import { notifySellerDecision } from "@/lib/email";

const allowedStatuses = new Set(["APPROVED", "REJECTED"]);
const allowedVerificationStatuses = new Set(["PENDING", "PASSED", "FAILED"]);

type UpdateSellerBody = {
  status?: "APPROVED" | "REJECTED";
  notes?: string;
  verifications?: { id: string; status: "PENDING" | "PASSED" | "FAILED" }[];
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const admin = await requireAdmin(request);
  if (!admin.ok) {
    return jsonError(admin.error, admin.status);
  }

  const body = await parseJson<UpdateSellerBody>(request);
  if (!body) {
    return jsonError("Invalid request body.");
  }
  if (body?.status && !allowedStatuses.has(body.status)) {
    return jsonError("status must be APPROVED or REJECTED.");
  }

  try {
    const seller = await prisma.$transaction(async (tx) => {
      if (body?.verifications?.length) {
        for (const verification of body.verifications) {
          if (!allowedVerificationStatuses.has(verification.status)) {
            throw new Error("Invalid verification status.");
          }
          await tx.verificationCheck.update({
            where: { id: verification.id },
            data: { status: verification.status },
          });
        }
      }

      if (body?.status === "APPROVED") {
        // Admin override: approving a seller marks all checks as PASSED.
        await tx.verificationCheck.updateMany({
          where: { sellerId: id },
          data: { status: "PASSED" },
        });
      }

      return tx.sellerProfile.update({
        where: { id },
        data: {
          status: body.status ?? undefined,
          approvedAt: body.status === "APPROVED" ? new Date() : null,
          manualNotes: body.notes?.trim(),
          payoutsEnabled:
            body.status === "APPROVED"
              ? true
              : body.status === "REJECTED"
                ? false
                : undefined,
        },
        include: { user: true, verifications: true },
      });
    });

    if (body?.status) {
      if (body.status === "APPROVED") {
        await prisma.user.update({
          where: { id: seller.userId },
          data: { role: "SELLER" },
        });
      } else if (body.status === "REJECTED") {
        await prisma.user.updateMany({
          where: { id: seller.userId, role: { not: "ADMIN" } },
          data: { role: "BUYER" },
        });
      }

      try {
        await notifySellerDecision({
          sellerId: seller.id,
          email: seller.user.email ?? "",
          displayName: seller.user.displayName ?? "Seller",
          status: body.status,
          notes: body.notes,
        });
      } catch (notifyError) {
        console.error("notifySellerDecision failed", notifyError);
      }
    }

    return jsonOk(seller);
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Unable to update application.",
      400,
    );
  }
}
