import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { jsonError, jsonOk, parseJson } from "@/lib/api";

type FollowBody = {
  followingId?: string;
};

function parseIds(value: string | null) {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, 50);
}

function normalizeFollowingId(body: FollowBody | null) {
  const value = typeof body?.followingId === "string" ? body.followingId.trim() : "";
  return value || null;
}

export async function GET(request: Request) {
  const sessionUser = await getSessionUser();
  const ids = parseIds(new URL(request.url).searchParams.get("ids"));

  if (ids.length === 0) {
    return jsonOk({ counts: {}, followedIds: [] });
  }

  const grouped = await prisma.userFollow.groupBy({
    by: ["followingId"],
    where: {
      followingId: { in: ids },
    },
    _count: {
      followingId: true,
    },
  });

  const counts = Object.fromEntries(
    ids.map((id) => [
      id,
      grouped.find((entry) => entry.followingId === id)?._count.followingId ?? 0,
    ]),
  );

  let followedIds: string[] = [];
  if (sessionUser?.id) {
    const follows = await prisma.userFollow.findMany({
      where: {
        followerId: sessionUser.id,
        followingId: { in: ids },
      },
      select: { followingId: true },
    });
    followedIds = follows.map((entry) => entry.followingId);
  }

  return jsonOk({ counts, followedIds });
}

export async function POST(request: Request) {
  const sessionUser = await getSessionUser();
  if (!sessionUser?.id) {
    return jsonError("Authentication required.", 401);
  }

  const followingId = normalizeFollowingId(await parseJson<FollowBody>(request));
  if (!followingId) {
    return jsonError("followingId is required.", 400);
  }

  if (followingId === sessionUser.id) {
    return jsonError("You cannot follow yourself.", 400);
  }

  const created = await prisma.userFollow.upsert({
    where: {
      followerId_followingId: {
        followerId: sessionUser.id,
        followingId,
      },
    },
    update: {},
    create: {
      followerId: sessionUser.id,
      followingId,
    },
    select: {
      id: true,
      followingId: true,
    },
  });

  return jsonOk(created, { status: 201 });
}

export async function DELETE(request: Request) {
  const sessionUser = await getSessionUser();
  if (!sessionUser?.id) {
    return jsonError("Authentication required.", 401);
  }

  const followingId = normalizeFollowingId(await parseJson<FollowBody>(request));
  if (!followingId) {
    return jsonError("followingId is required.", 400);
  }

  await prisma.userFollow.deleteMany({
    where: {
      followerId: sessionUser.id,
      followingId,
    },
  });

  return jsonOk({ removed: true });
}
