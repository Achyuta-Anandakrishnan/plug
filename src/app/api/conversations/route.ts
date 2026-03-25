import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk, parseJson } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { ensureProfileSchema } from "@/lib/profile-schema";

type CreateConversationBody = {
  participantIds?: string[];
  subject?: string;
  isSupport?: boolean;
};

export async function GET(request: Request) {
  await ensureProfileSchema().catch(() => null);

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";
  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 40), 1), 100);
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return jsonError("Authentication required.", 401);
  }

  const actorId = sessionUser.id;

  const conversations = await prisma.conversation.findMany({
    where: {
      participants: {
        some: { userId: actorId },
      },
      ...(query
        ? {
            OR: [
              { subject: { contains: query, mode: "insensitive" } },
              {
                participants: {
                  some: {
                    user: {
                      OR: [
                        { displayName: { contains: query, mode: "insensitive" } },
                        { username: { contains: query, mode: "insensitive" } },
                      ],
                    },
                  },
                },
              },
            ],
          }
        : {}),
    },
    include: {
      participants: {
        include: { user: { select: { displayName: true, username: true, id: true } } },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });

  return jsonOk({ items: conversations });
}

export async function POST(request: Request) {
  await ensureProfileSchema().catch(() => null);

  const body = await parseJson<CreateConversationBody>(request);

  if (!body?.participantIds || body.participantIds.length < 2) {
    return jsonError("At least two participants are required.");
  }

  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return jsonError("Authentication required.", 401);
  }

  const uniqueParticipants = Array.from(new Set(body.participantIds));

  if (!uniqueParticipants.includes(sessionUser.id)) {
    return jsonError("You must be a participant in the conversation.", 403);
  }

  const allowSupportFlag = Boolean(isAdminEmail(sessionUser.email));
  const isSupport = allowSupportFlag && Boolean(body.isSupport);

  const subject = body.subject?.trim() || null;
  if (!subject && !isSupport && uniqueParticipants.length === 2) {
    const existingDirect = await prisma.conversation.findFirst({
      where: {
        subject: null,
        isSupport: false,
        AND: uniqueParticipants.map((userId) => ({
          participants: { some: { userId } },
        })),
      },
      include: {
        participants: {
          include: { user: { select: { displayName: true, username: true, id: true } } },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (existingDirect && existingDirect.participants.length === 2) {
      return jsonOk(existingDirect);
    }
  }

  if (subject) {
    const existing = await prisma.conversation.findFirst({
      where: {
        subject,
        isSupport,
        participants: {
          every: { userId: { in: uniqueParticipants } },
        },
        AND: uniqueParticipants.map((userId) => ({
          participants: { some: { userId } },
        })),
      },
      include: {
        participants: {
          include: { user: { select: { displayName: true, username: true, id: true } } },
        },
      },
    });
    if (existing) return jsonOk(existing);
  }

  const conversation = await prisma.conversation.create({
    data: {
      subject,
      isSupport,
      participants: {
        create: uniqueParticipants.map((userId) => ({
          userId,
        })),
      },
    },
    include: {
      participants: {
        include: { user: { select: { displayName: true, username: true, id: true } } },
      },
    },
  });

  return jsonOk(conversation, { status: 201 });
}
