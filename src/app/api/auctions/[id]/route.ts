import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const auction = await prisma.auction.findUnique({
    where: { id },
    include: {
      category: true,
      item: { include: { images: true } },
      seller: {
        select: {
          id: true,
          status: true,
          user: { select: { displayName: true, id: true } },
        },
      },
      bids: { orderBy: { createdAt: "desc" }, take: 25 },
      chatMessages: {
        orderBy: { createdAt: "desc" },
        take: 25,
        include: { sender: { select: { displayName: true } } },
      },
      streamSessions: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  if (!auction) {
    return jsonError("Auction not found.", 404);
  }

  return jsonOk(auction);
}
