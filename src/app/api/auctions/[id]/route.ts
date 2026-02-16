import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";

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
          userId: true,
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

  if (auction.status === "DRAFT") {
    const sessionUser = await getSessionUser();
    const isAdmin = Boolean(
      sessionUser && (sessionUser.role === "ADMIN" || isAdminEmail(sessionUser.email)),
    );
    const isOwner = Boolean(sessionUser && auction.seller.userId === sessionUser.id);
    if (!isAdmin && !isOwner) {
      return jsonError("Not authorized.", 403);
    }
  }

  return jsonOk(auction);
}
