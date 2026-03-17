import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/api";

export async function GET() {
  const sessionUser = await getSessionUser();
  if (!sessionUser?.id) {
    return jsonError("Authentication required.", 401);
  }

  const orders = await prisma.order.findMany({
    where: { buyerId: sessionUser.id },
    orderBy: { createdAt: "desc" },
    include: {
      auction: {
        include: {
          item: {
            include: {
              images: {
                orderBy: { createdAt: "asc" },
                take: 1,
              },
            },
          },
        },
      },
      shipment: true,
      payment: true,
    },
    take: 50,
  });

  return jsonOk(orders);
}
