import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk, parseJson, checkRateLimit } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { ensureBountySchema, isBountySchemaMissing } from "@/lib/bounty-schema";

type CreateCommentBody = {
  body?: string;
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  await ensureBountySchema().catch(() => null);
  const { id } = await context.params;

  try {
    const bounty = await prisma.wantRequest.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!bounty) {
      return jsonError("Bounty not found.", 404);
    }

    const comments = await prisma.wantRequestComment.findMany({
      where: { wantRequestId: id },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            displayName: true,
            image: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return jsonOk(comments);
  } catch (error) {
    if (isBountySchemaMissing(error)) {
      return jsonError("Bounties are still initializing. Retry in a few seconds.", 503);
    }
    console.error("Bounty comments load failed", { id, error });
    return jsonError("Unable to load bounty comments right now.", 500);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  await ensureBountySchema().catch(() => null);

  const sessionUser = await getSessionUser();
  if (!sessionUser?.id) {
    return jsonError("Authentication required.", 401);
  }

  const { id } = await context.params;
  const payload = await parseJson<CreateCommentBody>(request);
  const body = payload?.body?.trim() ?? "";

  if (body.length < 2) {
    return jsonError("Comment must be at least 2 characters.", 400);
  }

  if (body.length > 400) {
    return jsonError("Comment must be 400 characters or fewer.", 400);
  }

  const rateLimitOk = await checkRateLimit(`bounty:comment:${sessionUser.id}`, 20, 60 * 60 * 1000);
  if (!rateLimitOk) {
    return jsonError("Too many comments. Try again later.", 429);
  }

  try {
    const bounty = await prisma.wantRequest.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!bounty) {
      return jsonError("Bounty not found.", 404);
    }

    if (bounty.status === "EXPIRED") {
      return jsonError("Cannot comment on an expired bounty.", 409);
    }

    const comment = await prisma.wantRequestComment.create({
      data: {
        wantRequestId: id,
        authorId: sessionUser.id,
        body,
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            displayName: true,
            image: true,
          },
        },
      },
    });

    return jsonOk(comment, { status: 201 });
  } catch (error) {
    if (isBountySchemaMissing(error)) {
      return jsonError("Bounties are still initializing. Retry in a few seconds.", 503);
    }
    console.error("Bounty comment create failed", { id, error });
    return jsonError("Unable to post comment right now.", 500);
  }
}
