import { prisma } from "@/lib/prisma";
import { checkRateLimit, jsonError, jsonOk, parseJson } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { isConversationSchemaMissing } from "@/lib/conversation-schema";

type CreateConversationBody = {
  participantIds?: string[];
  subject?: string;
  isSupport?: boolean;
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim() ?? "";
    const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 40), 1), 100);
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return jsonError("Authentication required.", 401);
    }

    const actorId = sessionUser.id;

    const conversationWhere = {
      participants: {
        some: { userId: actorId },
      },
      ...(query
        ? {
            OR: [
              { subject: { contains: query, mode: "insensitive" as const } },
              {
                participants: {
                  some: {
                    user: {
                      OR: [
                        { displayName: { contains: query, mode: "insensitive" as const } },
                        { username: { contains: query, mode: "insensitive" as const } },
                      ],
                    },
                  },
                },
              },
            ],
          }
        : {}),
    };

    const [conversations, profiles] = await Promise.all([
      prisma.conversation.findMany({
        where: conversationWhere,
        select: {
          id: true,
          subject: true,
          isSupport: true,
          updatedAt: true,
          participants: {
            select: {
              userId: true,
              user: {
                select: {
                  id: true,
                  username: true,
                  displayName: true,
                },
              },
            },
          },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              id: true,
              body: true,
              imageUrl: true,
              createdAt: true,
              senderId: true,
            },
          },
        },
        orderBy: { updatedAt: "desc" },
        take: limit,
      }),
      query
        ? prisma.user.findMany({
            where: {
              id: { not: actorId },
              OR: [
                { username: { contains: query, mode: "insensitive" } },
                { displayName: { contains: query, mode: "insensitive" } },
                { name: { contains: query, mode: "insensitive" } },
              ],
            },
            orderBy: { createdAt: "desc" },
            take: 8,
            select: {
              id: true,
              username: true,
              displayName: true,
              bio: true,
              image: true,
              role: true,
              sellerProfile: {
                select: {
                  status: true,
                  trustTier: true,
                  auctions: {
                    select: { id: true },
                    where: { status: "LIVE" },
                    take: 4,
                  },
                },
              },
            },
          })
        : Promise.resolve([]),
    ]);

    return jsonOk({ items: conversations, profiles });
  } catch (error) {
    if (isConversationSchemaMissing(error)) {
      return jsonError("Messages are initializing. Retry in a few seconds.", 503);
    }
    throw error;
  }
}

export async function POST(request: Request) {
  const body = await parseJson<CreateConversationBody>(request);

  if (!body?.participantIds || body.participantIds.length < 2) {
    return jsonError("At least two participants are required.");
  }

  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return jsonError("Authentication required.", 401);
  }

  const rateLimitOk = await checkRateLimit(`conversation:create:${sessionUser.id}`, 20, 60 * 60 * 1000);
  if (!rateLimitOk) {
    return jsonError("Conversation creation limit reached. Try again later.", 429);
  }

  const uniqueParticipants = Array.from(new Set(body.participantIds));
  if (uniqueParticipants.length > 10) {
    return jsonError("Too many conversation participants.", 400);
  }

  if (!uniqueParticipants.includes(sessionUser.id)) {
    return jsonError("You must be a participant in the conversation.", 403);
  }

  const participantCount = await prisma.user.count({
    where: { id: { in: uniqueParticipants } },
  });
  if (participantCount !== uniqueParticipants.length) {
    return jsonError("One or more participants could not be found.", 400);
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
