import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { jsonError, jsonOk, parseJson, checkRateLimit } from "@/lib/api";
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

const MAX_CASH_ADJUSTMENT = 100_000_00;
const MAX_MESSAGE_LENGTH = 600;
const MAX_CARD_NOTES_LENGTH = 240;
const MAX_EXPIRATION_WINDOW_MS = 1000 * 60 * 60 * 24 * 30;

function clampText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

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
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      select: { id: true },
    });

    if (existingActive) {
      return jsonError("You already have an active offer on this trade.", 409);
    }

    const rateLimitOk = await checkRateLimit(`trade:offer:${sessionUser.id}`, 20, 60 * 60 * 1000);
    if (!rateLimitOk) {
      return jsonError("Too many offers submitted. Try again later.", 429);
    }

    const body = await parseJson<CreateOfferBody>(request);
    if (!body) {
      return jsonError("Invalid request body.");
    }

    const cards = Array.isArray(body.cards)
      ? body.cards
        .map((card) => ({
          title: clampText(card?.title, 140),
          cardSet: clampText(card?.cardSet, 120),
          cardNumber: clampText(card?.cardNumber, 48),
          condition: clampText(card?.condition, 48),
          gradeCompany: clampText(card?.gradeCompany, 32),
          gradeLabel: clampText(card?.gradeLabel, 32),
          estimatedValue: parseIntOrNull(card?.estimatedValue),
          imageUrl: toHttpUrlOrNull(card?.imageUrl) ?? "",
          notes: clampText(card?.notes, MAX_CARD_NOTES_LENGTH),
        }))
        .filter((card) => card.title.length > 0 && (card.estimatedValue === null || card.estimatedValue >= 0))
        .slice(0, 16)
      : [];

    const cashAdj = parseIntOrNull(body.cashAdjustment) ?? 0;
    if (Math.abs(cashAdj) > MAX_CASH_ADJUSTMENT) {
      return jsonError("Cash adjustment exceeds the allowed limit.");
    }

    if (cashAdj !== 0) {
      const proposer = await prisma.user.findUnique({
        where: { id: sessionUser.id },
        select: { stripeCustomerId: true },
      });
      if (!proposer?.stripeCustomerId) {
        return jsonError("Connect a payment method before making cash offers.", 403);
      }
    }

    const message = clampText(body.message, MAX_MESSAGE_LENGTH);
    if (!message && cards.length === 0) {
      return jsonError("Add a message or at least one offered card.");
    }

    let expiresAt: Date | null = null;
    if (typeof body.expiresAt === "string" && body.expiresAt.trim()) {
      const parsed = new Date(body.expiresAt);
      if (Number.isNaN(parsed.getTime())) {
        return jsonError("Invalid expiration date.");
      }
      const now = Date.now();
      if (parsed.getTime() <= now) {
        return jsonError("Expiration must be in the future.");
      }
      if (parsed.getTime() - now > MAX_EXPIRATION_WINDOW_MS) {
        return jsonError("Expiration cannot be more than 30 days out.");
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
