import { prisma } from "@/lib/prisma";
import { isDev, jsonError, jsonOk, parseJson } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";

type CreateConversationBody = {
  participantIds?: string[];
  subject?: string;
  isSupport?: boolean;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionUser = await getSessionUser();
  const actorId =
    sessionUser?.id ?? (isDev() ? searchParams.get("userId") : null);

  if (!actorId) {
    return jsonError("Authentication required.", 401);
  }

  const conversations = await prisma.conversation.findMany({
    where: {
      participants: {
        some: { userId: actorId },
      },
    },
    include: {
      participants: {
        include: { user: { select: { displayName: true, id: true } } },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return jsonOk(conversations);
}

export async function POST(request: Request) {
  const body = await parseJson<CreateConversationBody>(request);

  if (!body?.participantIds || body.participantIds.length < 2) {
    return jsonError("At least two participants are required.");
  }

  const sessionUser = await getSessionUser();
  if (!sessionUser && !isDev()) {
    return jsonError("Authentication required.", 401);
  }

  const uniqueParticipants = Array.from(new Set(body.participantIds));

  if (!isDev()) {
    if (!sessionUser) {
      return jsonError("Authentication required.", 401);
    }
    if (!uniqueParticipants.includes(sessionUser.id)) {
      return jsonError("You must be a participant in the conversation.", 403);
    }
  }

  const allowSupportFlag = Boolean(
    sessionUser && (sessionUser.role === "ADMIN" || isAdminEmail(sessionUser.email)),
  );
  const isSupport = isDev() ? Boolean(body.isSupport) : allowSupportFlag && Boolean(body.isSupport);

  const conversation = await prisma.conversation.create({
    data: {
      subject: body.subject?.trim(),
      isSupport,
      participants: {
        create: uniqueParticipants.map((userId) => ({
          userId,
        })),
      },
    },
    include: {
      participants: {
        include: { user: { select: { displayName: true, id: true } } },
      },
    },
  });

  return jsonOk(conversation, { status: 201 });
}
