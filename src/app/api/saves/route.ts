import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { jsonError, jsonOk, parseJson } from "@/lib/api";

type SaveBody = {
  auctionId?: string;
  tradePostId?: string;
  bountyRequestId?: string;
  wantRequestId?: string;
};

function normalizeSaveBody(body: SaveBody | null) {
  const auctionId = typeof body?.auctionId === "string" ? body.auctionId.trim() : "";
  const tradePostId = typeof body?.tradePostId === "string" ? body.tradePostId.trim() : "";
  const bountyRequestId = typeof body?.bountyRequestId === "string" ? body.bountyRequestId.trim() : "";
  const wantRequestId = typeof body?.wantRequestId === "string" ? body.wantRequestId.trim() : "";
  const resolvedBountyId = bountyRequestId || wantRequestId;
  const count = [auctionId, tradePostId, resolvedBountyId].filter(Boolean).length;

  if (count !== 1) return null;

  return {
    auctionId: auctionId || null,
    tradePostId: tradePostId || null,
    wantRequestId: resolvedBountyId || null,
  };
}

export async function GET() {
  const sessionUser = await getSessionUser();
  if (!sessionUser?.id) {
    return jsonError("Authentication required.", 401);
  }

  const saves = await prisma.userSave.findMany({
    where: { userId: sessionUser.id },
    select: {
      auctionId: true,
      tradePostId: true,
      wantRequestId: true,
    },
  });

  return jsonOk({
    auctionIds: saves.map((entry) => entry.auctionId).filter((entry): entry is string => Boolean(entry)),
    tradePostIds: saves.map((entry) => entry.tradePostId).filter((entry): entry is string => Boolean(entry)),
    bountyRequestIds: saves.map((entry) => entry.wantRequestId).filter((entry): entry is string => Boolean(entry)),
    wantRequestIds: saves.map((entry) => entry.wantRequestId).filter((entry): entry is string => Boolean(entry)),
  });
}

export async function POST(request: Request) {
  const sessionUser = await getSessionUser();
  if (!sessionUser?.id) {
    return jsonError("Authentication required.", 401);
  }

  const saveTarget = normalizeSaveBody(await parseJson<SaveBody>(request));
  if (!saveTarget) {
    return jsonError("Provide exactly one save target.", 400);
  }

  const created = await prisma.userSave.upsert({
    where: saveTarget.auctionId
      ? { userId_auctionId: { userId: sessionUser.id, auctionId: saveTarget.auctionId } }
      : saveTarget.tradePostId
        ? { userId_tradePostId: { userId: sessionUser.id, tradePostId: saveTarget.tradePostId } }
        : { userId_wantRequestId: { userId: sessionUser.id, wantRequestId: saveTarget.wantRequestId! } },
    update: {},
    create: {
      userId: sessionUser.id,
      auctionId: saveTarget.auctionId,
      tradePostId: saveTarget.tradePostId,
      wantRequestId: saveTarget.wantRequestId,
    },
    select: {
      id: true,
      auctionId: true,
      tradePostId: true,
      wantRequestId: true,
    },
  });

  return jsonOk(created, { status: 201 });
}

export async function DELETE(request: Request) {
  const sessionUser = await getSessionUser();
  if (!sessionUser?.id) {
    return jsonError("Authentication required.", 401);
  }

  const saveTarget = normalizeSaveBody(await parseJson<SaveBody>(request));
  if (!saveTarget) {
    return jsonError("Provide exactly one save target.", 400);
  }

  await prisma.userSave.deleteMany({
    where: {
      userId: sessionUser.id,
      auctionId: saveTarget.auctionId,
      tradePostId: saveTarget.tradePostId,
      wantRequestId: saveTarget.wantRequestId,
    },
  });

  return jsonOk({ removed: true });
}
