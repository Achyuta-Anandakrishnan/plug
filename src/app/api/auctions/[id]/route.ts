import { jsonError, jsonOk } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { getAuctionDetail, getAuctionRoomSnapshot } from "@/lib/server/auction-loaders";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  const pollOnly = searchParams.get("poll") === "1";
  const auction = pollOnly ? await getAuctionRoomSnapshot(id) : await getAuctionDetail(id);

  if (!auction) {
    return jsonError("Auction not found.", 404);
  }

  if (auction.status === "DRAFT") {
    const sessionUser = await getSessionUser();
    const isAdmin = Boolean(
      sessionUser && isAdminEmail(sessionUser.email),
    );
    const isOwner = Boolean(sessionUser && auction.seller.userId === sessionUser.id);
    if (!isAdmin && !isOwner) {
      return jsonError("Not authorized.", 403);
    }
  }

  return jsonOk(auction);
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  const sessionUser = await getSessionUser();
  if (!sessionUser?.id) {
    return jsonError("Authentication required.", 401);
  }

  const isAdmin = isAdminEmail(sessionUser.email);

  const auction = await prisma.auction.findUnique({
    where: { id },
    include: {
      seller: true,
      bids: { where: { status: "ACTIVE" }, take: 1 },
      orders: { where: { status: { notIn: ["CANCELED", "REFUNDED"] } }, take: 1 },
    },
  });

  if (!auction) {
    return jsonError("Auction not found.", 404);
  }

  if (auction.seller.userId !== sessionUser.id && !isAdmin) {
    return jsonError("Not authorized.", 403);
  }

  if (auction.bids.length > 0 || auction.orders.length > 0) {
    return jsonError("Cannot cancel auction with active bids or orders.", 409);
  }

  await prisma.auction.update({ where: { id }, data: { status: "CANCELED" } });

  return jsonOk({ cancelled: true });
}
