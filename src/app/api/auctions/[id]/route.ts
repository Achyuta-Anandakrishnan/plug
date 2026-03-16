import { jsonError, jsonOk } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { getAuctionDetail, getAuctionRoomSnapshot } from "@/lib/server/auction-loaders";

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
