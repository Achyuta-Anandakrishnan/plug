import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { ensureProfileSchema } from "@/lib/profile-schema";

export async function GET(request: Request) {
  await ensureProfileSchema().catch(() => null);

  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return jsonError("Authentication required.", 401);
  }

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  const limitParam = Number(searchParams.get("limit") ?? 20);
  const take = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 50) : 20;

  const users = await prisma.user.findMany({
    where: q
      ? {
          OR: [
            { username: { contains: q, mode: "insensitive" } },
            { displayName: { contains: q, mode: "insensitive" } },
            { name: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      username: true,
      displayName: true,
      bio: true,
      image: true,
      createdAt: true,
      sellerProfile: {
        select: {
          trustTier: true,
          auctions: {
            where: { status: "LIVE" },
            select: { id: true },
            take: 4,
          },
        },
      },
    },
  });

  return jsonOk(users);
}
