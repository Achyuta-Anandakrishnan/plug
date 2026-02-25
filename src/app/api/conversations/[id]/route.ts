import { prisma } from "@/lib/prisma";
import { isDev, jsonError, jsonOk } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  const sessionUser = await getSessionUser();
  if (!sessionUser && !isDev()) {
    return jsonError("Authentication required.", 401);
  }

  if (!isDev()) {
    const participant = await prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId: id,
          userId: sessionUser!.id,
        },
      },
      select: { id: true },
    });

    if (!participant) {
      return jsonError("Not authorized.", 403);
    }
  }

  const existing = await prisma.conversation.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) {
    return jsonError("Conversation not found.", 404);
  }

  await prisma.$transaction(async (tx) => {
    await tx.directMessage.deleteMany({
      where: { conversationId: id },
    });
    await tx.conversationParticipant.deleteMany({
      where: { conversationId: id },
    });
    await tx.conversation.delete({
      where: { id },
    });
  });

  return jsonOk({ id, deleted: true });
}
