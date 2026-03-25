import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { jsonError, jsonOk, parseJson } from "@/lib/api";
import { parseIntOrNull, toHttpUrlOrNull } from "@/lib/trades";
import { ensureTradeSchema, isTradeSchemaMissing } from "@/lib/trade-schema";
import { tradeOfferWithDuelInclude } from "@/lib/trade-duel-service";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type CreateOfferCardBody = {
  title?: string;
  cardSet?: string;
  cardNumber?: string;
  condition?: string;
  gradeCompany?: string;
  gradeLabel?: string;
  estimatedValue?: number | string | null;
  imageUrl?: string;
  notes?: string;
};

type CreateOfferBody = {
  message?: string;
  cashAdjustment?: number | string | null;
  expiresAt?: string | null;
  cards?: CreateOfferCardBody[];
};

export async function GET(_request: Request, { params }: RouteContext) {
  await ensureTradeSchema().catch(() => null);
  try {
    const { id } = await params;
    const sessionUser = await getSessionUser();
    if (!sessionUser?.id) {
      return jsonError("Authentication required.", 401);
    }

    const post = await prisma.tradePost.findUnique({
      where: { id },
      select: { id: true, ownerId: true },
    });

    if (!post) {
      return jsonError("Trade post not found.", 404);
    }

    const offers = await prisma.tradeOffer.findMany({
      where: post.ownerId === sessionUser.id
        ? { postId: id }
        : { postId: id, proposerId: sessionUser.id },
      include: tradeOfferWithDuelInclude,
      orderBy: { createdAt: "desc" },
    });

    return jsonOk(offers);
  } catch (error) {
    if (isTradeSchemaMissing(error)) {
      await ensureTradeSchema().catch(() => null);
      return jsonError("Trade offers are initializing. Retry in a few seconds.", 503);
    }
    console.error("Trade offers GET failed", { error });
    return jsonError("Unable to load trade offers right now.", 500);
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  await ensureTradeSchema().catch(() => null);
  try {
    const { id } = await params;
    const sessionUser = await getSessionUser();
    if (!sessionUser?.id) {
      return jsonError("Authentication required.", 401);
    }

    const post = await prisma.tradePost.findUnique({
      where: { id },
      select: { id: true, ownerId: true, status: true },
    });

    if (!post) {
      return jsonError("Trade post not found.", 404);
    }

    if (post.ownerId === sessionUser.id) {
      return jsonError("You cannot submit an offer on your own trade.");
    }

    if (post.status !== "OPEN") {
      return jsonError("This trade is not open for offers right now.");
    }

    const existingActive = await prisma.tradeOffer.findFirst({
      where: {
        postId: id,
        proposerId: sessionUser.id,
        status: { in: ["PENDING", "COUNTERED"] },
      },
      select: { id: true },
    });

    if (existingActive) {
      return jsonError("You already have an active offer on this trade.", 409);
    }

    const body = await parseJson<CreateOfferBody>(request);
    if (!body) {
      return jsonError("Invalid request body.");
    }

    const cards = Array.isArray(body.cards)
      ? body.cards
        .map((card) => ({
          title: typeof card?.title === "string" ? card.title.trim() : "",
          cardSet: typeof card?.cardSet === "string" ? card.cardSet.trim() : "",
          cardNumber: typeof card?.cardNumber === "string" ? card.cardNumber.trim() : "",
          condition: typeof card?.condition === "string" ? card.condition.trim() : "",
          gradeCompany: typeof card?.gradeCompany === "string" ? card.gradeCompany.trim() : "",
          gradeLabel: typeof card?.gradeLabel === "string" ? card.gradeLabel.trim() : "",
          estimatedValue: parseIntOrNull(card?.estimatedValue),
          imageUrl: toHttpUrlOrNull(card?.imageUrl) ?? "",
          notes: typeof card?.notes === "string" ? card.notes.trim() : "",
        }))
        .filter((card) => card.title.length > 0)
        .slice(0, 16)
      : [];

    const cashAdj = parseIntOrNull(body.cashAdjustment) ?? 0;
    if (Math.abs(cashAdj) > 100_000_00) {
      return jsonError("Cash adjustment exceeds the allowed limit.");
    }

    const message = body.message?.trim() || "";
    if (!message && cards.length === 0) {
      return jsonError("Add a message or at least one offered card.");
    }

    let expiresAt: Date | null = null;
    if (typeof body.expiresAt === "string" && body.expiresAt.trim()) {
      const parsed = new Date(body.expiresAt);
      if (Number.isNaN(parsed.getTime())) {
        return jsonError("Invalid expiration date.");
      }
      expiresAt = parsed;
    }

    const created = await prisma.tradeOffer.create({
      data: {
        postId: id,
        proposerId: sessionUser.id,
        message: message || null,
        cashAdjustment: cashAdj,
        expiresAt,
        cards: cards.length > 0
          ? {
              create: cards.map((card) => ({
                title: card.title,
                cardSet: card.cardSet || null,
                cardNumber: card.cardNumber || null,
                condition: card.condition || null,
                gradeCompany: card.gradeCompany || null,
                gradeLabel: card.gradeLabel || null,
                estimatedValue: card.estimatedValue,
                imageUrl: card.imageUrl || null,
                notes: card.notes || null,
              })),
            }
          : undefined,
      },
      include: tradeOfferWithDuelInclude,
    });

    return jsonOk(created, { status: 201 });
  } catch (error) {
    if (isTradeSchemaMissing(error)) {
      await ensureTradeSchema().catch(() => null);
      return jsonError("Trade offers are initializing. Retry in a few seconds.", 503);
    }
    console.error("Trade offers POST failed", { error });
    return jsonError("Unable to submit offer right now.", 500);
  }
}
