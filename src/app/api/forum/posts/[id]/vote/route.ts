import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk, parseJson } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import {
  ensureForumSchema,
  isForumSchemaMissing,
  isForumVoteSchemaMissing,
} from "@/lib/forum-schema";

type VoteBody = {
  value?: -1 | 0 | 1;
};

function normalizeVoteValue(value: unknown): -1 | 0 | 1 | null {
  if (value === -1 || value === 0 || value === 1) return value;
  return null;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  await ensureForumSchema().catch(() => null);

  const sessionUser = await getSessionUser();
  if (!sessionUser?.id) return jsonError("Authentication required.", 401);

  const { id: postId } = await context.params;
  const body = await parseJson<VoteBody>(request);
  const value = normalizeVoteValue(body?.value);
  if (value === null) {
    return jsonError("value must be -1, 0, or 1.", 400);
  }

  try {
    const post = await prisma.forumPost.findUnique({
      where: { id: postId },
      select: { id: true },
    });
    if (!post) return jsonError("Post not found.", 404);

    if (value === 0) {
      await prisma.forumPostVote.deleteMany({
        where: {
          postId,
          userId: sessionUser.id,
        },
      });
    } else {
      await prisma.forumPostVote.upsert({
        where: {
          postId_userId: {
            postId,
            userId: sessionUser.id,
          },
        },
        create: {
          postId,
          userId: sessionUser.id,
          value,
        },
        update: {
          value,
        },
      });
    }

    const aggregate = await prisma.forumPostVote.aggregate({
      where: { postId },
      _sum: { value: true },
    });
    const mine = await prisma.forumPostVote.findUnique({
      where: {
        postId_userId: {
          postId,
          userId: sessionUser.id,
        },
      },
      select: { value: true },
    });

    return jsonOk({
      voteScore: aggregate._sum.value ?? 0,
      myVote: mine?.value ?? 0,
    });
  } catch (error) {
    if (isForumVoteSchemaMissing(error)) {
      return jsonError("Forum voting is not ready yet.", 503);
    }
    if (isForumSchemaMissing(error)) {
      return jsonError("Forum database is not ready yet.", 503);
    }
    throw error;
  }
}
