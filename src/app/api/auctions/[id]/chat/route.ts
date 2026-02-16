import { prisma } from "@/lib/prisma";
import { getDevBuyerId, isDev, jsonError, jsonOk, parseJson } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";

type CreateChatBody = {
  senderId?: string;
  body?: string;
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const messages = await prisma.auctionChatMessage.findMany({
    where: { auctionId: id },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { sender: { select: { displayName: true } } },
  });

  return jsonOk(messages);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = await parseJson<CreateChatBody>(request);
  const sessionUser = await getSessionUser();
  const senderId =
    sessionUser?.id ??
    (isDev() ? body?.senderId || getDevBuyerId() : null);

  if (!senderId) {
    return jsonError("Authentication required.", 401);
  }

  const text = body?.body?.trim() ?? "";
  if (!text) {
    return jsonError("body is required.", 400);
  }

  const auction = await prisma.auction.findUnique({
    where: { id },
    include: { seller: true },
  });

  if (!auction) {
    return jsonError("Auction not found.", 404);
  }

  // Never trust client-provided moderation flags.
  const isModerator = Boolean(
    sessionUser &&
      (sessionUser.role === "ADMIN" ||
        isAdminEmail(sessionUser.email) ||
        auction.seller.userId === sessionUser.id),
  );

  const message = await prisma.auctionChatMessage.create({
    data: {
      auctionId: id,
      senderId,
      body: text,
      isModerator,
    },
  });

  return jsonOk(message, { status: 201 });
}
