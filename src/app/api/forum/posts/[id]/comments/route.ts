import { ForumPostStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk, parseJson } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { ensureForumSchema } from "@/lib/forum-schema";

type CreateCommentBody = {
  body?: string;
  parentId?: string;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await ensureForumSchema();
  } catch {
    return jsonError("Forum database is not ready yet.", 503);
  }

  const sessionUser = await getSessionUser();
  if (!sessionUser) return jsonError("Authentication required.", 401);

  const { id: postId } = await context.params;
  const body = await parseJson<CreateCommentBody>(request);
  const text = body?.body?.trim() ?? "";
  const parentId = body?.parentId?.trim() || null;

  if (!text || text.length < 2) {
    return jsonError("body must be at least 2 characters.", 400);
  }

  const post = await prisma.forumPost.findUnique({
    where: { id: postId },
    select: { id: true, status: true, authorId: true },
  });

  if (!post) return jsonError("Post not found.", 404);
  if (
    post.status === ForumPostStatus.DRAFT
    && sessionUser.role !== "ADMIN"
    && sessionUser.id !== post.authorId
  ) {
    return jsonError("Post not found.", 404);
  }

  if (parentId) {
    const parent = await prisma.forumComment.findUnique({
      where: { id: parentId },
      select: { id: true, postId: true },
    });
    if (!parent || parent.postId !== postId) {
      return jsonError("Parent comment not found.", 404);
    }
  }

  const comment = await prisma.forumComment.create({
    data: {
      postId,
      authorId: sessionUser.id,
      parentId,
      body: text,
    },
    include: {
      author: { select: { id: true, displayName: true, image: true } },
    },
  });

  return jsonOk(comment, { status: 201 });
}
