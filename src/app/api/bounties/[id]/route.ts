import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { jsonError, jsonOk, parseJson } from "@/lib/api";
import { isBountySchemaMissing } from "@/lib/bounty-schema";
import { isBountyRequestStatus, type BountyRequestStatus } from "@/lib/bounties";

type PatchBountyBody = {
  status?: BountyRequestStatus;
};

const ALLOWED_STATUS_TRANSITIONS: Record<BountyRequestStatus, BountyRequestStatus[]> = {
  OPEN: ["PAUSED", "MATCHED", "FULFILLED", "EXPIRED"],
  PAUSED: ["OPEN", "EXPIRED"],
  MATCHED: ["OPEN", "FULFILLED", "EXPIRED"],
  FULFILLED: [],
  EXPIRED: [],
};

async function loadBounty(id: string) {
  return prisma.wantRequest.findUnique({
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
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const bounty = await loadBounty(id);

    if (!bounty) {
      return jsonError("Bounty not found.", 404);
    }

    if (bounty.status !== "OPEN") {
      const sessionUser = await getSessionUser();
      if (!sessionUser?.id || sessionUser.id !== bounty.userId) {
        return jsonError("Not authorized.", 403);
      }
    }

    return jsonOk(bounty);
  } catch (error) {
    if (isBountySchemaMissing(error)) {
      return jsonError("Bounties are initializing. Retry in a few seconds.", 503);
    }
    console.error("Bounty detail GET failed", { error });
    return jsonError("Unable to load bounty right now.", 500);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
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

    if (body?.status !== undefined) {
      if (!isBountyRequestStatus(body.status)) {
        return jsonError("Invalid status value.");
      }
      if (body.status !== bounty.status && !ALLOWED_STATUS_TRANSITIONS[bounty.status].includes(body.status)) {
        return jsonError("That status change is not allowed.", 409);
      }
    }

    const updated = await prisma.wantRequest.update({
      where: { id },
      data: {
        status: body?.status ?? bounty.status,
      },
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
  } catch (error) {
    if (isBountySchemaMissing(error)) {
      return jsonError("Bounties are initializing. Retry in a few seconds.", 503);
    }
    console.error("Bounty detail PATCH failed", { error });
    return jsonError("Unable to update bounty right now.", 500);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
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

    await prisma.wantRequest.update({
      where: { id },
      data: { status: "EXPIRED" },
    });

    return jsonOk({ deleted: true });
  } catch (error) {
    if (isBountySchemaMissing(error)) {
      return jsonError("Bounties are initializing. Retry in a few seconds.", 503);
    }
    console.error("Bounty detail DELETE failed", { error });
    return jsonError("Unable to delete bounty right now.", 500);
  }
}
