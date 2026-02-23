import { ForumPostStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk, parseJson } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { ensureForumSchema, isForumSchemaMissing } from "@/lib/forum-schema";
import { ensureProfileSchema } from "@/lib/profile-schema";

type UpdatePostBody = {
  title?: string;
  body?: string;
  status?: "draft" | "published";
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  await ensureForumSchema().catch(() => null);
  await ensureProfileSchema().catch(() => null);

  const { id } = await context.params;
  const sessionUser = await getSessionUser();

  let post;
  try {
    post = await prisma.forumPost.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, username: true, displayName: true, image: true } },
        comments: {
          orderBy: { createdAt: "asc" },
          include: {
            author: { select: { id: true, username: true, displayName: true, image: true } },
          },
        },
        _count: { select: { comments: true } },
      },
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
    && sessionUser?.id !== post.authorId
    && sessionUser?.role !== "ADMIN"
  ) {
    return jsonError("Post not found.", 404);
  }
  return jsonOk(post);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  await ensureForumSchema().catch(() => null);
  await ensureProfileSchema().catch(() => null);

  const sessionUser = await getSessionUser();
  if (!sessionUser?.id) return jsonError("Authentication required.", 401);

  const { id } = await context.params;
  const body = await parseJson<UpdatePostBody>(request);
  if (!body) return jsonError("Invalid request body.", 400);

  let existing;
  try {
    existing = await prisma.forumPost.findUnique({
      where: { id },
      select: { id: true, authorId: true, status: true, title: true, body: true },
    });
  } catch (error) {
    if (isForumSchemaMissing(error)) {
      return jsonError("Forum database is not ready yet.", 503);
    }
    throw error;
  }
  if (!existing) return jsonError("Post not found.", 404);
  if (existing.authorId !== sessionUser.id && sessionUser.role !== "ADMIN") {
    return jsonError("Forbidden.", 403);
  }

  const title = body.title?.trim();
  const text = body.body?.trim();

  const nextStatus = body.status === "draft"
    ? ForumPostStatus.DRAFT
    : body.status === "published"
      ? ForumPostStatus.PUBLISHED
      : undefined;

  const effectiveStatus = nextStatus ?? existing.status;
  const nextTitle = title !== undefined
    ? title
    : existing.title;
  const nextBody = text !== undefined
    ? text
    : existing.body;

  if (effectiveStatus === ForumPostStatus.PUBLISHED) {
    if (!nextTitle || nextTitle.length < 3) {
      return jsonError("title must be at least 3 characters.", 400);
    }
    if (!nextBody || nextBody.length < 10) {
      return jsonError("body must be at least 10 characters.", 400);
    }
  } else if ((title !== undefined || text !== undefined) && !nextTitle && !nextBody) {
    return jsonError("Provide a title or body to save a draft.", 400);
  }

  let post;
  try {
    post = await prisma.forumPost.update({
      where: { id },
      data: {
        title: title !== undefined ? title || "Untitled draft" : undefined,
        body: text !== undefined ? text || "Draft body" : undefined,
        status: nextStatus,
        publishedAt: nextStatus === ForumPostStatus.PUBLISHED
          ? existing.status === ForumPostStatus.PUBLISHED
            ? undefined
            : new Date()
          : nextStatus === ForumPostStatus.DRAFT
            ? null
            : undefined,
      },
      include: {
        author: { select: { id: true, username: true, displayName: true, image: true } },
        _count: { select: { comments: true } },
      },
    });
  } catch (error) {
    if (isForumSchemaMissing(error)) {
      return jsonError("Forum database is not ready yet.", 503);
    }
    throw error;
  }

  return jsonOk(post);
}
