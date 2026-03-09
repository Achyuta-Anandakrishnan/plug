import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk, parseJson } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { TRADE_POST_STATUSES, normalizeTags, parseIntOrNull, toHttpUrlOrNull } from "@/lib/trades";

type CreateTradePostBody = {
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
  images?: Array<{ url: string; isPrimary?: boolean }>;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionUser = await getSessionUser();
  const mine = searchParams.get("mine") === "1";
  const statusParam = searchParams.get("status");
  const q = searchParams.get("q")?.trim() ?? "";
  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 30), 1), 80);

  const where: Prisma.TradePostWhereInput = {};

  if (mine) {
    if (!sessionUser?.id) {
      return jsonError("Authentication required.", 401);
    }
    where.ownerId = sessionUser.id;
  } else if (statusParam && TRADE_POST_STATUSES.includes(statusParam as (typeof TRADE_POST_STATUSES)[number])) {
    where.status = statusParam as (typeof TRADE_POST_STATUSES)[number];
  } else {
    where.status = "OPEN";
  }

  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { lookingFor: { contains: q, mode: "insensitive" } },
      { cardSet: { contains: q, mode: "insensitive" } },
      { category: { contains: q, mode: "insensitive" } },
    ];
  }

  const posts = await prisma.tradePost.findMany({
    where,
    include: {
      owner: {
        select: {
          id: true,
          username: true,
          displayName: true,
        },
      },
      images: {
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      },
      _count: {
        select: { offers: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return jsonOk(posts);
}

export async function POST(request: Request) {
  const sessionUser = await getSessionUser();
  if (!sessionUser?.id) {
    return jsonError("Authentication required.", 401);
  }

  const body = await parseJson<CreateTradePostBody>(request);
  if (!body?.title?.trim()) {
    return jsonError("Title is required.");
  }
  if (!body?.lookingFor?.trim()) {
    return jsonError("Looking-for details are required.");
  }

  const images = (body.images ?? [])
    .map((entry) => ({
      url: toHttpUrlOrNull(entry?.url) ?? "",
      isPrimary: Boolean(entry?.isPrimary),
    }))
    .filter((entry) => entry.url.length > 0)
    .slice(0, 12);

  const tags = normalizeTags(body.tags);
  const valueMin = parseIntOrNull(body.valueMin);
  const valueMax = parseIntOrNull(body.valueMax);

  const post = await prisma.tradePost.create({
    data: {
      ownerId: sessionUser.id,
      title: body.title.trim(),
      description: body.description?.trim() || null,
      category: body.category?.trim() || null,
      cardSet: body.cardSet?.trim() || null,
      cardNumber: body.cardNumber?.trim() || null,
      condition: body.condition?.trim() || null,
      gradeCompany: body.gradeCompany?.trim() || null,
      gradeLabel: body.gradeLabel?.trim() || null,
      lookingFor: body.lookingFor.trim(),
      preferredBrands: body.preferredBrands?.trim() || null,
      location: body.location?.trim() || null,
      shippingMode: body.shippingMode?.trim() || null,
      tags: tags.length > 0 ? (tags as unknown as Prisma.InputJsonValue) : undefined,
      valueMin,
      valueMax,
      images: images.length > 0
        ? {
            create: images.map((entry, index) => ({
              url: entry.url,
              isPrimary: entry.isPrimary || index === 0,
            })),
          }
        : undefined,
    },
    include: {
      owner: {
        select: {
          id: true,
          username: true,
          displayName: true,
        },
      },
      images: {
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      },
      _count: {
        select: { offers: true },
      },
    },
  });

  return jsonOk(post, { status: 201 });
}
