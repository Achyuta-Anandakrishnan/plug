import { ForumPostStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk, parseJson } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import {
  ensureForumSchema,
  isForumSchemaMissing,
  isForumVoteSchemaMissing,
} from "@/lib/forum-schema";
import { ensureProfileSchema, isProfileSchemaMissing } from "@/lib/profile-schema";

type CreatePostBody = {
  title?: string;
  body?: string;
  status?: "draft" | "published";
};

type PostRow = {
  id: string;
  title: string;
  body: string;
  status: ForumPostStatus;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  author: {
    id: string;
    username: string | null;
    displayName: string | null;
    image: string | null;
  };
  _count: { comments: number };
};

export async function GET(request: Request) {
  await ensureForumSchema().catch(() => null);
  await ensureProfileSchema().catch(() => null);

  const { searchParams } = new URL(request.url);
  const sessionUser = await getSessionUser();
  const q = (searchParams.get("q") ?? "").trim();
  const requestedStatus = (searchParams.get("status") ?? "published").toLowerCase();
  const mineOnly = searchParams.get("mine") === "1";

  if (!["draft", "published"].includes(requestedStatus)) {
    return jsonError("Invalid status filter.", 400);
  }
  if ((requestedStatus === "draft" || mineOnly) && !sessionUser?.id) {
    return jsonError("Authentication required.", 401);
  }

  const status = requestedStatus === "draft"
    ? ForumPostStatus.DRAFT
    : ForumPostStatus.PUBLISHED;

  let posts: PostRow[];
  try {
    posts = await prisma.forumPost.findMany({
      where: {
        status,
        ...(mineOnly || status === ForumPostStatus.DRAFT
          ? { authorId: sessionUser?.id }
          : undefined),
        ...(q
          ? {
              OR: [
                { title: { contains: q, mode: "insensitive" } },
                { body: { contains: q, mode: "insensitive" } },
              ],
            }
          : undefined),
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        author: { select: { id: true, username: true, displayName: true, image: true } },
        _count: { select: { comments: true } },
      },
    });
  } catch (error) {
    if (isForumSchemaMissing(error)) {
      return jsonOk([]);
    }
    if (!isProfileSchemaMissing(error)) {
      throw error;
    }

    const fallbackPosts = await prisma.forumPost.findMany({
      where: {
        status,
        ...(mineOnly || status === ForumPostStatus.DRAFT
          ? { authorId: sessionUser?.id }
          : undefined),
        ...(q
          ? {
              OR: [
                { title: { contains: q, mode: "insensitive" } },
                { body: { contains: q, mode: "insensitive" } },
              ],
            }
          : undefined),
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        author: { select: { id: true, displayName: true, image: true } },
        _count: { select: { comments: true } },
      },
    });

    posts = fallbackPosts.map((post) => ({
      ...post,
      author: { ...post.author, username: null },
    }));
  }

  const postIds = posts.map((post) => post.id);
  const voteScoreByPost = new Map<string, number>();
  const myVoteByPost = new Map<string, number>();

  if (postIds.length) {
    try {
      const groupedVotes = await prisma.forumPostVote.groupBy({
        by: ["postId"],
        where: { postId: { in: postIds } },
        _sum: { value: true },
      });
      for (const row of groupedVotes) {
        voteScoreByPost.set(row.postId, row._sum.value ?? 0);
      }

      if (sessionUser?.id) {
        const myVotes = await prisma.forumPostVote.findMany({
          where: {
            userId: sessionUser.id,
            postId: { in: postIds },
          },
          select: {
            postId: true,
            value: true,
          },
        });
        for (const row of myVotes) {
          myVoteByPost.set(row.postId, row.value);
        }
      }
    } catch (error) {
      if (isForumVoteSchemaMissing(error)) {
        // Keep forum readable even if vote schema is not deployed yet.
      } else if (isForumSchemaMissing(error)) {
        return jsonError("Forum database is not ready yet.", 503);
      } else {
        throw error;
      }
    }
  }

  return jsonOk(
    posts.map((post) => ({
      ...post,
      voteScore: voteScoreByPost.get(post.id) ?? 0,
      myVote: myVoteByPost.get(post.id) ?? 0,
    })),
  );
}

export async function POST(request: Request) {
  await ensureForumSchema().catch(() => null);
  await ensureProfileSchema().catch(() => null);

  const sessionUser = await getSessionUser();
  if (!sessionUser) return jsonError("Authentication required.", 401);

  const body = await parseJson<CreatePostBody>(request);
  const title = body?.title?.trim() ?? "";
  const text = body?.body?.trim() ?? "";
  const desiredStatus = body?.status === "draft"
    ? ForumPostStatus.DRAFT
    : ForumPostStatus.PUBLISHED;

  if (desiredStatus === ForumPostStatus.PUBLISHED) {
    if (!title || title.length < 3) {
      return jsonError("title must be at least 3 characters.", 400);
    }
    if (!text || text.length < 10) {
      return jsonError("body must be at least 10 characters.", 400);
    }
  } else if (!title && !text) {
    return jsonError("Provide a title or body to save a draft.", 400);
  }

  let post: PostRow;
  try {
    post = await prisma.forumPost.create({
      data: {
        authorId: sessionUser.id,
        title: title || "Untitled draft",
        body: text || "Draft body",
        status: desiredStatus,
        publishedAt: desiredStatus === ForumPostStatus.PUBLISHED ? new Date() : null,
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
    if (!isProfileSchemaMissing(error)) {
      throw error;
    }

    const fallbackPost = await prisma.forumPost.create({
      data: {
        authorId: sessionUser.id,
        title: title || "Untitled draft",
        body: text || "Draft body",
        status: desiredStatus,
        publishedAt: desiredStatus === ForumPostStatus.PUBLISHED ? new Date() : null,
      },
      include: {
        author: { select: { id: true, displayName: true, image: true } },
        _count: { select: { comments: true } },
      },
    });

    post = {
      ...fallbackPost,
      author: {
        ...fallbackPost.author,
        username: null,
      },
    };
  }

  return jsonOk({ ...post, voteScore: 0, myVote: 0 }, { status: 201 });
}
