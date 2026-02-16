import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk, parseJson } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { ensureLiveKitRoom, livekitEnabled } from "@/lib/livekit";
import { isAdminEmail } from "@/lib/admin";

type StreamSessionBody = {
  auctionId?: string;
};

export async function POST(request: Request) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return jsonError("Authentication required.", 401);
  }

  if (!livekitEnabled()) {
    return jsonError("LiveKit not configured.", 400);
  }

  const body = await parseJson<StreamSessionBody>(request);
  if (!body?.auctionId) {
    return jsonError("auctionId is required.");
  }

  const auction = await prisma.auction.findUnique({
    where: { id: body.auctionId },
    include: { seller: true },
  });

  if (!auction) {
    return jsonError("Auction not found.", 404);
  }

  if (
    auction.seller.userId !== sessionUser.id &&
    sessionUser.role !== "ADMIN" &&
    !isAdminEmail(sessionUser.email)
  ) {
    return jsonError("Not authorized to start this stream.", 403);
  }

  let session = await prisma.streamSession.findFirst({
    where: { auctionId: auction.id, provider: "LIVEKIT" },
    orderBy: { createdAt: "desc" },
  });

  if (!session) {
    const roomName = `auction-${auction.id}`;
    await ensureLiveKitRoom(roomName);
    session = await prisma.streamSession.create({
      data: {
        auctionId: auction.id,
        provider: "LIVEKIT",
        status: "CREATED",
        roomName,
      },
    });
  }

  return jsonOk(session, { status: 201 });
}

type StreamStatusBody = {
  auctionId?: string;
  status?: "ENDED" | "DISABLED";
};

export async function PATCH(request: Request) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return jsonError("Authentication required.", 401);
  }

  const body = await parseJson<StreamStatusBody>(request);
  if (!body?.auctionId || !body.status) {
    return jsonError("auctionId and status are required.");
  }

  const auction = await prisma.auction.findUnique({
    where: { id: body.auctionId },
    include: { seller: true },
  });

  if (!auction) {
    return jsonError("Auction not found.", 404);
  }

  if (
    auction.seller.userId !== sessionUser.id &&
    sessionUser.role !== "ADMIN" &&
    !isAdminEmail(sessionUser.email)
  ) {
    return jsonError("Not authorized to update this stream.", 403);
  }

  const session = await prisma.streamSession.findFirst({
    where: { auctionId: auction.id, provider: "LIVEKIT" },
    orderBy: { createdAt: "desc" },
  });

  if (!session) {
    return jsonError("Stream session not found.", 404);
  }

  const updated = await prisma.streamSession.update({
    where: { id: session.id },
    data: { status: body.status },
  });

  return jsonOk(updated);
}
