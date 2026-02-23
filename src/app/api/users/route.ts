import { prisma } from "@/lib/prisma";
import { jsonOk } from "@/lib/api";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  const limitParam = Number(searchParams.get("limit") ?? 20);
  const take = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 50) : 20;

  const users = await prisma.user.findMany({
    where: q
      ? {
          OR: [
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
      displayName: true,
      image: true,
      createdAt: true,
      role: true,
      sellerProfile: {
        select: {
          status: true,
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
