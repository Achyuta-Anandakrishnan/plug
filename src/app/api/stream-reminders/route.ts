import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { jsonError, jsonOk, parseJson } from "@/lib/api";

type ReminderBody = {
  auctionId?: string;
};

function normalizeAuctionId(body: ReminderBody | null) {
  const auctionId = typeof body?.auctionId === "string" ? body.auctionId.trim() : "";
  return auctionId || null;
}

export async function GET() {
  const sessionUser = await getSessionUser();
  if (!sessionUser?.id) {
    return jsonError("Authentication required.", 401);
  }

  const reminders = await prisma.streamReminder.findMany({
    where: { userId: sessionUser.id },
    select: { auctionId: true },
  });

  return jsonOk({
    auctionIds: reminders.map((entry) => entry.auctionId),
  });
}

export async function POST(request: Request) {
  const sessionUser = await getSessionUser();
  if (!sessionUser?.id) {
    return jsonError("Authentication required.", 401);
  }

  const auctionId = normalizeAuctionId(await parseJson<ReminderBody>(request));
  if (!auctionId) {
    return jsonError("auctionId is required.", 400);
  }

  const created = await prisma.streamReminder.upsert({
    where: {
      userId_auctionId: {
        userId: sessionUser.id,
        auctionId,
      },
    },
    update: {},
    create: {
      userId: sessionUser.id,
      auctionId,
    },
    select: {
      id: true,
      auctionId: true,
    },
  });

  return jsonOk(created, { status: 201 });
}

export async function DELETE(request: Request) {
  const sessionUser = await getSessionUser();
  if (!sessionUser?.id) {
    return jsonError("Authentication required.", 401);
  }

  const auctionId = normalizeAuctionId(await parseJson<ReminderBody>(request));
  if (!auctionId) {
    return jsonError("auctionId is required.", 400);
  }

  await prisma.streamReminder.deleteMany({
    where: {
      userId: sessionUser.id,
      auctionId,
    },
  });

  return jsonOk({ removed: true });
}
