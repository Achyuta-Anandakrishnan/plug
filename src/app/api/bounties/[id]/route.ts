import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { jsonError, jsonOk, parseJson } from "@/lib/api";
import { isBountyRequestStatus, type BountyRequestStatus } from "@/lib/bounties";

type PatchBountyBody = {
  status?: BountyRequestStatus;
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  const bounty = await prisma.wantRequest.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          displayName: true,
          image: true,
        },
      },
    },
  });

  if (!bounty) {
    return jsonError("Bounty not found.", 404);
  }

  // Non-public statuses — only the owner can view
  if (bounty.status === "EXPIRED" || bounty.status === "MATCHED") {
    const sessionUser = await getSessionUser();
    if (!sessionUser?.id || sessionUser.id !== bounty.userId) {
      return jsonError("Not authorized.", 403);
    }
  }

  return jsonOk(bounty);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  const sessionUser = await getSessionUser();
  if (!sessionUser?.id) {
    return jsonError("Authentication required.", 401);
  }

  const bounty = await prisma.wantRequest.findUnique({ where: { id } });

  if (!bounty) {
    return jsonError("Bounty not found.", 404);
  }

  if (bounty.userId !== sessionUser.id) {
    return jsonError("Not authorized.", 403);
  }

  const body = await parseJson<PatchBountyBody>(request);

  const data: { status?: BountyRequestStatus } = {};

  if (body?.status !== undefined) {
    if (!isBountyRequestStatus(body.status)) {
      return jsonError("Invalid status value.");
    }
    data.status = body.status;
  }

  const updated = await prisma.wantRequest.update({
    where: { id },
    data,
    include: {
      user: {
        select: {
          id: true,
          username: true,
          displayName: true,
          image: true,
        },
      },
    },
  });

  return jsonOk(updated);
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  const sessionUser = await getSessionUser();
  if (!sessionUser?.id) {
    return jsonError("Authentication required.", 401);
  }

  const bounty = await prisma.wantRequest.findUnique({ where: { id } });

  if (!bounty) {
    return jsonError("Bounty not found.", 404);
  }

  if (bounty.userId !== sessionUser.id) {
    return jsonError("Not authorized.", 403);
  }

  if (bounty.status === "FULFILLED") {
    return jsonError("Cannot delete a fulfilled bounty.", 409);
  }

  // Soft-delete: mark as EXPIRED (no CLOSED status in schema)
  await prisma.wantRequest.update({
    where: { id },
    data: { status: "EXPIRED" },
  });

  return jsonOk({ deleted: true });
}
