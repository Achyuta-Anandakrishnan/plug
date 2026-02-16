import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk, parseJson } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";

type CreateCommentBody = {
  body?: string;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return jsonError("Authentication required.", 401);

  const { id: postId } = await context.params;
  const body = await parseJson<CreateCommentBody>(request);
  const text = body?.body?.trim() ?? "";

  if (!text || text.length < 2) {
    return jsonError("body must be at least 2 characters.", 400);
  }

  const post = await prisma.forumPost.findUnique({
    where: { id: postId },
    select: { id: true },
  });

  if (!post) return jsonError("Post not found.", 404);

  const comment = await prisma.forumComment.create({
    data: {
      postId,
      authorId: sessionUser.id,
      body: text,
    },
    include: {
      author: { select: { id: true, displayName: true, image: true } },
    },
  });

  return jsonOk(comment, { status: 201 });
}

