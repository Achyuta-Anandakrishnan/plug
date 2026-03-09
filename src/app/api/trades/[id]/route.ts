import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { jsonError, jsonOk, parseJson } from "@/lib/api";
import { isTradePostStatus, normalizeTags, parseIntOrNull } from "@/lib/trades";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type UpdateTradePostBody = {
  title?: string;
  description?: string;
  category?: string;
  cardSet?: string;
  cardNumber?: string;
  condition?: string;
  gradeCompany?: string;
  gradeLabel?: string;
  lookingFor?: string;
  preferredBrands?: string;
  location?: string;
  shippingMode?: string;
  tags?: string[];
  valueMin?: number | string | null;
  valueMax?: number | string | null;
  status?: string;
  images?: Array<{ url: string; isPrimary?: boolean }>;
};

const postInclude = {
  owner: {
    select: {
      id: true,
      username: true,
      displayName: true,
      image: true,
    },
  },
  images: {
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
  },
  offers: {
    orderBy: { createdAt: "desc" },
    include: {
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
    },
  },
  _count: {
    select: { offers: true },
  },
} satisfies Prisma.TradePostInclude;

export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const sessionUser = await getSessionUser();
  const post = await prisma.tradePost.findUnique({
    where: { id },
    include: postInclude,
  });

  if (!post) {
    return jsonError("Trade post not found.", 404);
  }

  const isOwner = sessionUser?.id === post.ownerId;
  const offers = isOwner
    ? post.offers
    : sessionUser?.id
      ? post.offers.filter((offer) => offer.proposerId === sessionUser.id)
      : [];

  return jsonOk({
    ...post,
    offers,
    viewer: {
      isOwner,
      canOffer: Boolean(sessionUser?.id && !isOwner && post.status === "OPEN"),
      canEdit: isOwner,
    },
  });
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const sessionUser = await getSessionUser();
  if (!sessionUser?.id) {
    return jsonError("Authentication required.", 401);
  }

  const existing = await prisma.tradePost.findUnique({
    where: { id },
    select: { id: true, ownerId: true, status: true },
  });

  if (!existing) {
    return jsonError("Trade post not found.", 404);
  }

  if (existing.ownerId !== sessionUser.id) {
    return jsonError("Only the owner can update this trade post.", 403);
  }

  const body = await parseJson<UpdateTradePostBody>(request);
  if (!body) {
    return jsonError("Invalid request body.");
  }

  const updateData: Prisma.TradePostUpdateInput = {};

  if (typeof body.title === "string") {
    const title = body.title.trim();
    if (!title) return jsonError("Title cannot be empty.");
    updateData.title = title;
  }
  if (typeof body.description === "string" || body.description === null) {
    updateData.description = body.description?.trim() || null;
  }
  if (typeof body.category === "string" || body.category === null) {
    updateData.category = body.category?.trim() || null;
  }
  if (typeof body.cardSet === "string" || body.cardSet === null) {
    updateData.cardSet = body.cardSet?.trim() || null;
  }
  if (typeof body.cardNumber === "string" || body.cardNumber === null) {
    updateData.cardNumber = body.cardNumber?.trim() || null;
  }
  if (typeof body.condition === "string" || body.condition === null) {
    updateData.condition = body.condition?.trim() || null;
  }
  if (typeof body.gradeCompany === "string" || body.gradeCompany === null) {
    updateData.gradeCompany = body.gradeCompany?.trim() || null;
  }
  if (typeof body.gradeLabel === "string" || body.gradeLabel === null) {
    updateData.gradeLabel = body.gradeLabel?.trim() || null;
  }
  if (typeof body.lookingFor === "string") {
    const lookingFor = body.lookingFor.trim();
    if (!lookingFor) return jsonError("Looking-for details cannot be empty.");
    updateData.lookingFor = lookingFor;
  }
  if (typeof body.preferredBrands === "string" || body.preferredBrands === null) {
    updateData.preferredBrands = body.preferredBrands?.trim() || null;
  }
  if (typeof body.location === "string" || body.location === null) {
    updateData.location = body.location?.trim() || null;
  }
  if (typeof body.shippingMode === "string" || body.shippingMode === null) {
    updateData.shippingMode = body.shippingMode?.trim() || null;
  }
  if (body.tags !== undefined) {
    const tags = normalizeTags(body.tags);
    updateData.tags = tags.length > 0 ? (tags as unknown as Prisma.InputJsonValue) : Prisma.JsonNull;
  }
  if (body.valueMin !== undefined) {
    updateData.valueMin = parseIntOrNull(body.valueMin);
  }
  if (body.valueMax !== undefined) {
    updateData.valueMax = parseIntOrNull(body.valueMax);
  }
  if (body.status !== undefined) {
    if (!isTradePostStatus(body.status)) {
      return jsonError("Invalid trade post status.");
    }
    updateData.status = body.status;
  }

  const imagePayload = Array.isArray(body.images)
    ? body.images
      .map((entry) => ({
        url: typeof entry?.url === "string" ? entry.url.trim() : "",
        isPrimary: Boolean(entry?.isPrimary),
      }))
      .filter((entry) => entry.url)
      .slice(0, 12)
    : null;

  const updated = await prisma.tradePost.update({
    where: { id },
    data: {
      ...updateData,
      images: imagePayload
        ? {
            deleteMany: {},
            create: imagePayload.map((entry, index) => ({
              url: entry.url,
              isPrimary: entry.isPrimary || index === 0,
            })),
          }
        : undefined,
    },
    include: postInclude,
  });

  return jsonOk(updated);
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const sessionUser = await getSessionUser();
  if (!sessionUser?.id) {
    return jsonError("Authentication required.", 401);
  }

  const existing = await prisma.tradePost.findUnique({
    where: { id },
    select: { ownerId: true },
  });

  if (!existing) {
    return jsonError("Trade post not found.", 404);
  }

  if (existing.ownerId !== sessionUser.id) {
    return jsonError("Only the owner can archive this trade post.", 403);
  }

  const archived = await prisma.tradePost.update({
    where: { id },
    data: { status: "ARCHIVED" },
    include: postInclude,
  });

  return jsonOk(archived);
}
