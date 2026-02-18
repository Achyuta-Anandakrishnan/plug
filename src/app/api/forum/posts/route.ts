import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk, parseJson } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { ensureForumSchema } from "@/lib/forum-schema";

type CreatePostBody = {
  title?: string;
  body?: string;
};

export async function GET(request: Request) {
  try {
    await ensureForumSchema();
  } catch {
    return jsonError("Forum database is not ready yet.", 503);
  }

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();

  const posts = await prisma.forumPost.findMany({
    where: q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { body: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      author: { select: { id: true, displayName: true, image: true } },
      _count: { select: { comments: true } },
    },
  });

  return jsonOk(posts);
}

export async function POST(request: Request) {
  try {
    await ensureForumSchema();
  } catch {
    return jsonError("Forum database is not ready yet.", 503);
  }

  const sessionUser = await getSessionUser();
  if (!sessionUser) return jsonError("Authentication required.", 401);

  const body = await parseJson<CreatePostBody>(request);
  const title = body?.title?.trim() ?? "";
  const text = body?.body?.trim() ?? "";

  if (!title || title.length < 3) {
    return jsonError("title must be at least 3 characters.", 400);
  }
  if (!text || text.length < 10) {
    return jsonError("body must be at least 10 characters.", 400);
  }

  const post = await prisma.forumPost.create({
    data: {
      authorId: sessionUser.id,
      title,
      body: text,
    },
    include: {
      author: { select: { id: true, displayName: true, image: true } },
      _count: { select: { comments: true } },
    },
  });

  return jsonOk(post, { status: 201 });
}
