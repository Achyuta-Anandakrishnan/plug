import { prisma } from "@/lib/prisma";
import { isDev, jsonError, jsonOk, parseJson } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";

type MessageBody = {
  senderId?: string;
  body?: string;
};

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 40), 1), 100);
  const before = searchParams.get("before");
  const beforeDate = before ? new Date(before) : null;

  if (!isDev()) {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return jsonError("Authentication required.", 401);
    }
    const participant = await prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId: id,
          userId: sessionUser.id,
        },
      },
    });
    if (!participant) {
      return jsonError("Not authorized.", 403);
    }
  }

  const messages = await prisma.directMessage.findMany({
    where: {
      conversationId: id,
      ...(beforeDate && !Number.isNaN(beforeDate.valueOf())
        ? { createdAt: { lt: beforeDate } }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    include: {
      sender: { select: { displayName: true, id: true } },
    },
  });

  const hasMore = messages.length > limit;
  const visibleMessages = hasMore ? messages.slice(0, limit) : messages;
  const nextCursor = hasMore
    ? visibleMessages[visibleMessages.length - 1]?.createdAt.toISOString() ?? null
    : null;

  return jsonOk({
    items: [...visibleMessages].reverse(),
    nextCursor,
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const sessionUser = await getSessionUser();
  if (!sessionUser && !isDev()) {
    return jsonError("Authentication required.", 401);
  }

  const { id } = await context.params;
  const body = await parseJson<MessageBody>(request);
  const senderId = sessionUser?.id ?? (isDev() ? body?.senderId : null);

  const text = body?.body?.trim() ?? "";
  if (!senderId || !text) {
    return jsonError("Authentication and body are required.", 401);
  }

  if (!isDev()) {
    const participant = await prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId: id,
          userId: senderId,
        },
      },
    });
    if (!participant) {
      return jsonError("Not authorized.", 403);
    }
  }

  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.directMessage.create({
      data: {
        conversationId: id,
        senderId,
        body: text,
      },
    });

    // Keep conversation ordering consistent with latest message activity.
    await tx.conversation.update({
      where: { id },
      data: { updatedAt: new Date() },
    });

    return tx.directMessage.findUnique({
      where: { id: created.id },
      include: { sender: { select: { displayName: true, id: true } } },
    });
  });

  return jsonOk(message, { status: 201 });
}
