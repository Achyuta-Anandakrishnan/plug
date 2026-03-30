import { prisma } from "@/lib/prisma";
import { checkRateLimit, jsonError, jsonOk, parseJson } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { isConversationSchemaMissing } from "@/lib/conversation-schema";
import { isOwnedScopedUploadUrl } from "@/lib/upload-validation";

type MessageBody = {
  body?: string;
  imageUrl?: string | null;
};

const MAX_MESSAGE_LENGTH = 1200;

function normalizeImageUrl(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("/")) {
    return trimmed;
  }
  return null;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 40), 1), 100);
    const before = searchParams.get("before");
    const beforeDate = before ? new Date(before) : null;

    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return jsonError("Authentication required.", 401);
    }
    const conversation = await prisma.conversation.findFirst({
      where: {
        id,
        participants: {
          some: { userId: sessionUser.id },
        },
      },
      select: {
        messages: {
          where: beforeDate && !Number.isNaN(beforeDate.valueOf())
            ? { createdAt: { lt: beforeDate } }
            : undefined,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: limit + 1,
          select: {
            id: true,
            senderId: true,
            body: true,
            imageUrl: true,
            createdAt: true,
            sender: {
              select: {
                displayName: true,
                id: true,
              },
            },
          },
        },
      },
    });

    if (!conversation) {
      return jsonError("Not authorized.", 403);
    }

    const messages = conversation.messages;

    const hasMore = messages.length > limit;
    const visibleMessages = hasMore ? messages.slice(0, limit) : messages;
    const nextCursor = hasMore
      ? visibleMessages[visibleMessages.length - 1]?.createdAt.toISOString() ?? null
      : null;

    return jsonOk({
      items: [...visibleMessages].reverse(),
      nextCursor,
    });
  } catch (error) {
    if (isConversationSchemaMissing(error)) {
      return jsonError("Messages are initializing. Retry in a few seconds.", 503);
    }
    throw error;
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return jsonError("Authentication required.", 401);
    }

    const { id } = await context.params;
    const body = await parseJson<MessageBody>(request);
    const senderId = sessionUser.id;

    const text = body?.body?.trim().slice(0, MAX_MESSAGE_LENGTH) ?? "";
    const imageUrl = normalizeImageUrl(body?.imageUrl);
    if (!text && !imageUrl) {
      return jsonError("Message body or image is required.", 400);
    }
    if (imageUrl && !isOwnedScopedUploadUrl(imageUrl, "messages", senderId)) {
      return jsonError("Message attachment is invalid.", 400);
    }

    const rateLimitOk = await checkRateLimit(`message:send:${senderId}`, 90, 60 * 60 * 1000);
    if (!rateLimitOk) {
      return jsonError("Message limit reached. Try again later.", 429);
    }

    const conversation = await prisma.conversation.findFirst({
      where: {
        id,
        participants: {
          some: { userId: senderId },
        },
      },
      select: { id: true },
    });
    if (!conversation) {
      return jsonError("Not authorized.", 403);
    }

    const perConversationRateLimitOk = await checkRateLimit(`message:send:${senderId}:${id}`, 30, 60 * 1000);
    if (!perConversationRateLimitOk) {
      return jsonError("Too many messages sent too quickly.", 429);
    }

    const created = await prisma.directMessage.create({
      data: {
        conversationId: id,
        senderId,
        body: text,
        imageUrl,
      },
      include: { sender: { select: { displayName: true, id: true } } },
    });

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    });

    return jsonOk(created, { status: 201 });
  } catch (error) {
    if (isConversationSchemaMissing(error)) {
      return jsonError("Messages are initializing. Retry in a few seconds.", 503);
    }
    throw error;
  }
}
