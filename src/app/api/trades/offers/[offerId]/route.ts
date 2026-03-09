import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { jsonError, jsonOk, parseJson } from "@/lib/api";
import { isTradeOfferStatus } from "@/lib/trades";

type RouteContext = {
  params: Promise<{
    offerId: string;
  }>;
};

type UpdateOfferBody = {
  status?: string;
};

const offerInclude = {
  proposer: {
    select: {
      id: true,
      username: true,
      displayName: true,
      image: true,
    },
  },
  cards: {
    orderBy: { createdAt: "asc" },
  },
} as const;

export async function PATCH(request: Request, { params }: RouteContext) {
  const { offerId } = await params;
  const sessionUser = await getSessionUser();
  if (!sessionUser?.id) {
    return jsonError("Authentication required.", 401);
  }

  const body = await parseJson<UpdateOfferBody>(request);
  if (!body?.status || !isTradeOfferStatus(body.status)) {
    return jsonError("Invalid offer status.");
  }

  const offer = await prisma.tradeOffer.findUnique({
    where: { id: offerId },
    include: {
      post: {
        select: {
          id: true,
          ownerId: true,
          status: true,
        },
      },
    },
  });

  if (!offer) {
    return jsonError("Offer not found.", 404);
  }

  const isOwner = offer.post.ownerId === sessionUser.id;
  const isProposer = offer.proposerId === sessionUser.id;
  if (!isOwner && !isProposer) {
    return jsonError("Not authorized to update this offer.", 403);
  }

  const nextStatus = body.status;

  if (nextStatus === "WITHDRAWN") {
    if (!isProposer) {
      return jsonError("Only the proposer can withdraw this offer.", 403);
    }
    if (!["PENDING", "COUNTERED"].includes(offer.status)) {
      return jsonError("Only active offers can be withdrawn.");
    }

    const updated = await prisma.tradeOffer.update({
      where: { id: offer.id },
      data: { status: "WITHDRAWN" },
      include: offerInclude,
    });
    return jsonOk(updated);
  }

  if (nextStatus === "ACCEPTED") {
    if (!isOwner) {
      return jsonError("Only the trade owner can accept offers.", 403);
    }
    if (!["PENDING", "COUNTERED"].includes(offer.status)) {
      return jsonError("Only active offers can be accepted.");
    }

    const accepted = await prisma.$transaction(async (tx) => {
      await tx.tradeOffer.updateMany({
        where: {
          postId: offer.postId,
          id: { not: offer.id },
          status: { in: ["PENDING", "COUNTERED"] },
        },
        data: { status: "DECLINED" },
      });

      await tx.tradePost.update({
        where: { id: offer.postId },
        data: { status: "MATCHED" },
      });

      return tx.tradeOffer.update({
        where: { id: offer.id },
        data: { status: "ACCEPTED" },
        include: offerInclude,
      });
    });

    return jsonOk(accepted);
  }

  if (nextStatus === "DECLINED" || nextStatus === "COUNTERED") {
    if (!isOwner) {
      return jsonError("Only the trade owner can update offer state.", 403);
    }
    if (!["PENDING", "COUNTERED"].includes(offer.status)) {
      return jsonError("Only active offers can be updated.");
    }

    const updated = await prisma.tradeOffer.update({
      where: { id: offer.id },
      data: { status: nextStatus },
      include: offerInclude,
    });
    return jsonOk(updated);
  }

  return jsonError("Unsupported status update.");
}
