import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk, parseJson } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/api";
import { TRADE_POST_STATUSES, normalizeTags, parseIntOrNull, toHttpUrlOrNull } from "@/lib/trades";
import { ensureTradeSchema, isTradeSchemaMissing } from "@/lib/trade-schema";

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

function getSearchParams(request: Request) {
  try {
    return new URL(request.url).searchParams;
  } catch {
    return new URL(request.url, "http://localhost").searchParams;
  }
}

export async function GET(request: Request) {
  await ensureTradeSchema().catch(() => null);
  const searchParams = getSearchParams(request);
  try {
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
  } catch (error) {
    if (isTradeSchemaMissing(error)) {
      await ensureTradeSchema().catch(() => null);
      return jsonError("Trades are initializing. Retry in a few seconds.", 503);
    }
    return jsonError("Unable to load trades right now.", 500);
  }
}

export async function POST(request: Request) {
  await ensureTradeSchema().catch(() => null);
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser?.id) {
      return jsonError("Authentication required.", 401);
    }

    const rateLimitOk = await checkRateLimit(`trade:create:${sessionUser.id}`, 10, 60 * 60 * 1000);
    if (!rateLimitOk) {
      return jsonError("Too many trade posts created. Try again later.", 429);
    }

    const body = await parseJson<CreateTradePostBody>(request);
    const title = body?.title?.trim().slice(0, 140) ?? "";
    const lookingFor = body?.lookingFor?.trim().slice(0, 300) ?? "";
    if (!title) {
      return jsonError("Title is required.");
    }
    if (!lookingFor) {
      return jsonError("Looking-for details are required.");
    }

    const images = (body?.images ?? [])
      .map((entry) => ({
        url: toHttpUrlOrNull(entry?.url) ?? "",
        isPrimary: Boolean(entry?.isPrimary),
      }))
      .filter((entry) => entry.url.length > 0)
      .slice(0, 12);

    const tags = normalizeTags(body?.tags);
    const valueMin = parseIntOrNull(body?.valueMin);
    const valueMax = parseIntOrNull(body?.valueMax);

    const post = await prisma.tradePost.create({
      data: {
        ownerId: sessionUser.id,
        title,
        description: body?.description?.trim().slice(0, 1000) || null,
        category: body?.category?.trim().slice(0, 80) || null,
        cardSet: body?.cardSet?.trim().slice(0, 120) || null,
        cardNumber: body?.cardNumber?.trim().slice(0, 48) || null,
        condition: body?.condition?.trim().slice(0, 48) || null,
        gradeCompany: body?.gradeCompany?.trim().slice(0, 32) || null,
        gradeLabel: body?.gradeLabel?.trim().slice(0, 32) || null,
        lookingFor,
        preferredBrands: body?.preferredBrands?.trim().slice(0, 200) || null,
        location: body?.location?.trim().slice(0, 120) || null,
        shippingMode: body?.shippingMode?.trim().slice(0, 80) || null,
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
  } catch (error) {
    if (isTradeSchemaMissing(error)) {
      await ensureTradeSchema().catch(() => null);
      return jsonError("Trades are initializing. Retry in a few seconds.", 503);
    }
    return jsonError("Unable to create trade post.", 500);
  }
}
