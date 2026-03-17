import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { jsonError, jsonOk, parseJson } from "@/lib/api";

type SaveBody = {
  auctionId?: string;
  tradePostId?: string;
};

function normalizeSaveBody(body: SaveBody | null) {
  const auctionId = typeof body?.auctionId === "string" ? body.auctionId.trim() : "";
  const tradePostId = typeof body?.tradePostId === "string" ? body.tradePostId.trim() : "";

  if (!auctionId && !tradePostId) return null;
  if (auctionId && tradePostId) return null;

  return {
    auctionId: auctionId || null,
    tradePostId: tradePostId || null,
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
    },
  });

  return jsonOk({
    auctionIds: saves.map((entry) => entry.auctionId).filter((entry): entry is string => Boolean(entry)),
    tradePostIds: saves.map((entry) => entry.tradePostId).filter((entry): entry is string => Boolean(entry)),
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
      : { userId_tradePostId: { userId: sessionUser.id, tradePostId: saveTarget.tradePostId! } },
    update: {},
    create: {
      userId: sessionUser.id,
      auctionId: saveTarget.auctionId,
      tradePostId: saveTarget.tradePostId,
    },
    select: {
      id: true,
      auctionId: true,
      tradePostId: true,
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
    },
  });

  return jsonOk({ removed: true });
}
