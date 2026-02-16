import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api";
import { requireAdmin } from "@/lib/admin";

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin.ok) {
    return jsonError(admin.error, admin.status);
  }

  const sellers = await prisma.sellerProfile.findMany({
    where: { status: "IN_REVIEW" },
    include: {
      user: {
        select: { id: true, email: true, displayName: true, phone: true },
      },
      verifications: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return jsonOk(sellers);
}
