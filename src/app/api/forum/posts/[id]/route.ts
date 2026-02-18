import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api";
import { ensureForumSchema } from "@/lib/forum-schema";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await ensureForumSchema();
  } catch {
    return jsonError("Forum database is not ready yet.", 503);
  }

  const { id } = await context.params;

  const post = await prisma.forumPost.findUnique({
    where: { id },
    include: {
      author: { select: { id: true, displayName: true, image: true } },
      comments: {
        orderBy: { createdAt: "asc" },
        include: {
          author: { select: { id: true, displayName: true, image: true } },
        },
      },
      _count: { select: { comments: true } },
    },
  });

  if (!post) return jsonError("Post not found.", 404);
  return jsonOk(post);
}
