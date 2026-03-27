import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk, parseJson } from "@/lib/api";
import { requireAdmin } from "@/lib/admin";
import { normalizeAccountStatus } from "@/lib/account-status";
import { ensureProfileSchema } from "@/lib/profile-schema";

const ALLOWED_ROLES = new Set<UserRole>(["BUYER", "SELLER", "ADMIN"]);
const ALLOWED_ACCOUNT_STATUSES = new Set(["ACTIVE", "SUSPENDED", "DISABLED"]);

type UpdateAdminProfileBody = {
  role?: string;
  accountStatus?: string;
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin(request);
  if (!admin.ok) {
    return jsonError(admin.error, admin.status);
  }

  await ensureProfileSchema().catch(() => null);

  const body = await parseJson<UpdateAdminProfileBody>(request);
  if (!body) {
    return jsonError("Invalid request body.", 400);
  }

  const role = body.role?.trim().toUpperCase() as UserRole | undefined;
  const accountStatus = body.accountStatus?.trim().toUpperCase();

  if (!role && !accountStatus) {
    return jsonError("No profile changes provided.", 400);
  }
  if (role && !ALLOWED_ROLES.has(role)) {
    return jsonError("Invalid role.", 400);
  }
  if (accountStatus && !ALLOWED_ACCOUNT_STATUSES.has(accountStatus)) {
    return jsonError("Invalid account status.", 400);
  }

  const { id } = await context.params;

  const existing = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      role: true,
      accountStatus: true,
      sellerProfile: {
        select: {
          id: true,
          status: true,
        },
      },
    },
  });

  if (!existing) {
    return jsonError("Profile not found.", 404);
  }

  const nextRole = role ?? existing.role;
  const nextAccountStatus = normalizeAccountStatus(accountStatus ?? existing.accountStatus);

  const updated = await prisma.$transaction(async (tx) => {
    if (nextRole === "SELLER" && !existing.sellerProfile) {
      await tx.sellerProfile.create({
        data: {
          userId: existing.id,
          status: "APPROVED",
          approvedAt: new Date(),
        },
      });
    } else if (existing.sellerProfile) {
      if (nextAccountStatus !== "ACTIVE" && existing.sellerProfile.status !== "SUSPENDED") {
        await tx.sellerProfile.update({
          where: { id: existing.sellerProfile.id },
          data: { status: "SUSPENDED" },
        });
      } else if (
        nextAccountStatus === "ACTIVE"
        && nextRole === "SELLER"
        && existing.sellerProfile.status === "SUSPENDED"
      ) {
        await tx.sellerProfile.update({
          where: { id: existing.sellerProfile.id },
          data: { status: "APPROVED", approvedAt: new Date() },
        });
      }
    }

    return tx.user.update({
      where: { id: existing.id },
      data: {
        ...(role ? { role: nextRole } : {}),
        ...(accountStatus ? { accountStatus: nextAccountStatus } : {}),
      },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        bio: true,
        image: true,
        role: true,
        accountStatus: true,
        createdAt: true,
        sellerProfile: {
          select: {
            status: true,
            trustTier: true,
          },
        },
      },
    });
  });

  return jsonOk(updated);
}
