import { ForumPostStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk, parseJson } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { ensureForumSchema, isForumSchemaMissing } from "@/lib/forum-schema";
import { ensureProfileSchema, isProfileSchemaMissing } from "@/lib/profile-schema";

type CreateCommentBody = {
  body?: string;
  parentId?: string;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  await ensureForumSchema().catch(() => null);
  await ensureProfileSchema().catch(() => null);

  const sessionUser = await getSessionUser();
  if (!sessionUser) return jsonError("Authentication required.", 401);

  const { id: postId } = await context.params;
  const body = await parseJson<CreateCommentBody>(request);
  const text = body?.body?.trim() ?? "";
  const parentId = body?.parentId?.trim() || null;

  if (!text || text.length < 2) {
    return jsonError("body must be at least 2 characters.", 400);
  }

  let post;
  try {
    post = await prisma.forumPost.findUnique({
      where: { id: postId },
      select: { id: true, status: true, authorId: true },
    });
  } catch (error) {
    if (isForumSchemaMissing(error)) {
      return jsonError("Forum database is not ready yet.", 503);
    }
    throw error;
  }

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

  let comment;
  try {
    comment = await prisma.forumComment.create({
      data: {
        postId,
        authorId: sessionUser.id,
        parentId,
        body: text,
      },
      include: {
        author: { select: { id: true, username: true, displayName: true, image: true } },
      },
    });
  } catch (error) {
    if (isForumSchemaMissing(error)) {
      return jsonError("Forum database is not ready yet.", 503);
    }
    if (!isProfileSchemaMissing(error)) {
      throw error;
    }

    const fallbackComment = await prisma.forumComment.create({
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

    comment = {
      ...fallbackComment,
      author: {
        ...fallbackComment.author,
        username: null,
      },
    };
  }

  return jsonOk(comment, { status: 201 });
}
