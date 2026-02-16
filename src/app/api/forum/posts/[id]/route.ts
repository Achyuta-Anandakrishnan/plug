import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
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

