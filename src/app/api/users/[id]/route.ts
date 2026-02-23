import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      displayName: true,
      name: true,
      image: true,
      createdAt: true,
      role: true,
      sellerProfile: {
        select: {
          status: true,
          trustTier: true,
          approvedAt: true,
          auctions: {
            where: { status: { in: ["LIVE", "SCHEDULED"] } },
            orderBy: { createdAt: "desc" },
            take: 10,
            select: {
              id: true,
              title: true,
              status: true,
              listingType: true,
              currentBid: true,
              buyNowPrice: true,
              currency: true,
              category: { select: { name: true } },
              item: {
                select: {
                  images: {
                    orderBy: { createdAt: "asc" },
                    take: 1,
                    select: { url: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!user) return jsonError("User not found.", 404);
  return jsonOk(user);
}
