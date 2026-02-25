import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api";
import { requireAdmin } from "@/lib/admin";
import { ensureProfileSchema } from "@/lib/profile-schema";

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin.ok) {
    return jsonError(admin.error, admin.status);
  }

  await ensureProfileSchema().catch(() => null);

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  const limitParam = Number(searchParams.get("limit") ?? 300);
  const take = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 1000) : 300;

  const users = await prisma.user.findMany({
    where: q
      ? {
          OR: [
            { username: { contains: q, mode: "insensitive" } },
            { displayName: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { name: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      email: true,
      username: true,
      displayName: true,
      bio: true,
      image: true,
      role: true,
      createdAt: true,
      sellerProfile: {
        select: {
          status: true,
          trustTier: true,
        },
      },
    },
  });

  return jsonOk(users);
}
