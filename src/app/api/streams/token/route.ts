import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk, parseJson } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { createLiveKitToken, livekitEnabled } from "@/lib/livekit";
import { isAdminEmail } from "@/lib/admin";

type TokenBody = {
  auctionId?: string;
  role?: "host" | "viewer";
};

export async function POST(request: Request) {
  if (!livekitEnabled()) {
    return jsonError("LiveKit not configured.", 400);
  }

  const body = await parseJson<TokenBody>(request);
  if (!body?.auctionId) {
    return jsonError("auctionId is required.");
  }

  const auction = await prisma.auction.findUnique({
    where: { id: body.auctionId },
    include: { seller: true, streamSessions: { orderBy: { createdAt: "desc" }, take: 1 } },
  });

  if (!auction) {
    return jsonError("Auction not found.", 404);
  }

  const sessionUser = await getSessionUser();
  const isSeller = sessionUser?.id === auction.seller.userId;
  const role = body.role ?? (isSeller ? "host" : "viewer");

  if (role === "host" && !isSeller && sessionUser?.role !== "ADMIN" && !isAdminEmail(sessionUser?.email)) {
    return jsonError("Not authorized to host this stream.", 403);
  }

  const session = auction.streamSessions[0];
  if (!session?.roomName) {
    return jsonError("Stream not started yet.", 409);
  }

  const identity = sessionUser?.id ?? `guest-${randomUUID()}`;
  const token = await createLiveKitToken({
    identity,
    name: sessionUser?.id ?? "Guest viewer",
    roomName: session.roomName,
    canPublish: role === "host",
    canSubscribe: true,
  });

  if (!token) {
    return jsonError("Unable to create token.", 500);
  }

  if (role === "host" && session.status !== "LIVE") {
    await prisma.streamSession.update({
      where: { id: session.id },
      data: { status: "LIVE" },
    });
  }

  if (role === "host" && auction.status !== "LIVE") {
    await prisma.auction.update({
      where: { id: auction.id },
      data: { status: "LIVE", startTime: auction.startTime ?? new Date() },
    });
  }

  return jsonOk({
    token,
    roomName: session.roomName,
    url: process.env.LIVEKIT_URL,
  });
}
