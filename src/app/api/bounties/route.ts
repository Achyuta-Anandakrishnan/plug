import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { jsonError, jsonOk, parseJson } from "@/lib/api";
import { parseIntOrNull, toHttpUrlOrNull } from "@/lib/trades";
import { checkRateLimit } from "@/lib/api";
import { isBountySchemaMissing } from "@/lib/bounty-schema";
import {
  bountyBudgetValue,
  bountySpecificityScore,
  isBountyRequestStatus,
  type BountyRequestListItem,
  type BountyRequestStatus,
} from "@/lib/bounties";

type CreateBountyBody = {
  title?: string;
  itemName?: string;
  category?: string;
  player?: string;
  setName?: string;
  year?: string;
  gradeCompany?: string;
  gradeTarget?: string;
  grade?: string;
  condition?: string;
  certNumber?: string;
  priceMin?: number | string | null;
  priceMax?: number | string | null;
  bountyAmount?: number | string | null;
  notes?: string;
  imageUrl?: string;
  status?: BountyRequestStatus;
};

type BountyGradeFilter = "all" | "raw" | "psa" | "bgs" | "cgc" | "high-grade";
type BountyBudgetFilter = "all" | "under-500" | "500-2500" | "2500-10000" | "10000-plus";
type BountySortMode = "newest" | "highest-bounty" | "highest-budget" | "most-specific" | "recently-active";
const MAX_MONEY_CENTS = 100_000_000;

function getSearchParams(request: Request) {
  try {
    return new URL(request.url).searchParams;
  } catch {
    return new URL(request.url, "http://localhost").searchParams;
  }
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function clampText(value: unknown, maxLength: number) {
  return normalizeText(value).slice(0, maxLength);
}

function sanitizeMoney(value: number | null, fieldLabel: string) {
  if (value === null) return null;
  if (value < 0) {
    throw new Error(`${fieldLabel} cannot be negative.`);
  }
  if (value > MAX_MONEY_CENTS) {
    throw new Error(`${fieldLabel} exceeds the allowed limit.`);
  }
  return value;
}

function normalizePriceBounds(priceMin: number | null, priceMax: number | null) {
  if (priceMin !== null && priceMax !== null && priceMax < priceMin) {
    return { priceMin: priceMax, priceMax: priceMin };
  }
  return { priceMin, priceMax };
}

function asListItem(entry: {
  id: string;
  userId: string;
  title: string;
  category: string | null;
  itemName: string;
  player: string | null;
  setName: string | null;
  year: string | null;
  gradeCompany: string | null;
  gradeTarget: string | null;
  grade: string | null;
  condition: string | null;
  certNumber: string | null;
  priceMin: number | null;
  priceMax: number | null;
  bountyAmount: number | null;
  notes: string | null;
  imageUrl: string | null;
  status: BountyRequestStatus;
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: string;
    username: string | null;
    displayName: string | null;
    image: string | null;
  };
}): BountyRequestListItem {
  return {
    ...entry,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  };
}

function matchesGradeFilter(entry: BountyRequestListItem, filter: BountyGradeFilter) {
  if (filter === "all") return true;
  const value = `${entry.gradeCompany ?? ""} ${entry.gradeTarget ?? ""} ${entry.grade ?? ""} ${entry.condition ?? ""}`.toLowerCase();
  if (filter === "raw") {
    return value.includes("raw") || value.includes("ungraded") || (!entry.gradeTarget && !entry.grade && !entry.gradeCompany);
  }
  if (filter === "psa") return value.includes("psa");
  if (filter === "bgs") return value.includes("bgs") || value.includes("bvg");
  if (filter === "cgc") return value.includes("cgc") || value.includes("csg") || value.includes("cdc");
  if (filter === "high-grade") return /(10|9|gem|mint)/.test(value);
  return true;
}

function matchesBudgetFilter(entry: BountyRequestListItem, filter: BountyBudgetFilter) {
  if (filter === "all") return true;
  const budget = bountyBudgetValue(entry);
  if (filter === "under-500") return budget > 0 && budget < 50000;
  if (filter === "500-2500") return budget >= 50000 && budget < 250000;
  if (filter === "2500-10000") return budget >= 250000 && budget < 1000000;
  if (filter === "10000-plus") return budget >= 1000000;
  return true;
}

function sortEntries(entries: BountyRequestListItem[], sort: BountySortMode) {
  const next = [...entries];
  if (sort === "highest-bounty") {
    next.sort((a, b) => (b.bountyAmount ?? 0) - (a.bountyAmount ?? 0));
    return next;
  }
  if (sort === "highest-budget") {
    next.sort((a, b) => bountyBudgetValue(b) - bountyBudgetValue(a));
    return next;
  }
  if (sort === "most-specific") {
    next.sort((a, b) => {
      const scoreDelta = bountySpecificityScore(b) - bountySpecificityScore(a);
      if (scoreDelta !== 0) return scoreDelta;
      const bountyDelta = (b.bountyAmount ?? 0) - (a.bountyAmount ?? 0);
      if (bountyDelta !== 0) return bountyDelta;
      return bountyBudgetValue(b) - bountyBudgetValue(a);
    });
    return next;
  }
  if (sort === "recently-active") {
    next.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return next;
  }
  next.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return next;
}

export async function GET(request: Request) {
  try {
    const searchParams = getSearchParams(request);
    const q = searchParams.get("q")?.trim() ?? "";
    const category = searchParams.get("category")?.trim() ?? "";
    const grade = (searchParams.get("grade")?.trim() ?? "all") as BountyGradeFilter;
    const budget = (searchParams.get("budget")?.trim() ?? "all") as BountyBudgetFilter;
    const sort = (searchParams.get("sort")?.trim() ?? "newest") as BountySortMode;
    const mine = searchParams.get("mine") === "1";
    const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 80), 1), 120);
    const requestedStatus = searchParams.get("status");
    const status = requestedStatus && isBountyRequestStatus(requestedStatus) ? requestedStatus : "OPEN";

    const sessionUser = mine ? await getSessionUser() : null;
    if (mine && !sessionUser?.id) {
      return jsonError("Authentication required.", 401);
    }

    const where: Prisma.WantRequestWhereInput = {
      status,
    };

    if (mine && sessionUser?.id) {
      where.userId = sessionUser.id;
    }

    if (category) {
      where.category = { equals: category, mode: "insensitive" };
    }

    if (q) {
      where.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { itemName: { contains: q, mode: "insensitive" } },
        { player: { contains: q, mode: "insensitive" } },
        { setName: { contains: q, mode: "insensitive" } },
        { year: { contains: q, mode: "insensitive" } },
        { gradeCompany: { contains: q, mode: "insensitive" } },
        { gradeTarget: { contains: q, mode: "insensitive" } },
        { grade: { contains: q, mode: "insensitive" } },
        { notes: { contains: q, mode: "insensitive" } },
        { certNumber: { contains: q, mode: "insensitive" } },
        { category: { contains: q, mode: "insensitive" } },
      ];
    }

    const bounties = await prisma.wantRequest.findMany({
      where,
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
      orderBy: { updatedAt: "desc" },
      take: limit,
    });

    const filtered = bounties
      .map(asListItem)
      .filter((entry) => matchesGradeFilter(entry, grade))
      .filter((entry) => matchesBudgetFilter(entry, budget));

    return jsonOk(sortEntries(filtered, sort));
  } catch (error) {
    if (isBountySchemaMissing(error)) {
      return jsonError("Bounties are initializing. Retry in a few seconds.", 503);
    }
    console.error("Bounties GET failed", { error });
    return jsonError("Unable to load bounties right now.", 500);
  }
}

export async function POST(request: Request) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser?.id) {
      return jsonError("Authentication required.", 401);
    }

    const rateLimitOk = await checkRateLimit(`bounty:create:${sessionUser.id}`, 10, 60 * 60 * 1000);
    if (!rateLimitOk) {
      return jsonError("Too many bounties created. Try again later.", 429);
    }

    const body = await parseJson<CreateBountyBody>(request);
    const itemName = clampText(body?.itemName, 140);
    const title = clampText(body?.title, 140) || itemName;
    const priceMin = sanitizeMoney(parseIntOrNull(body?.priceMin), "Budget minimum");
    const priceMax = sanitizeMoney(parseIntOrNull(body?.priceMax), "Budget maximum");
    const bountyAmount = sanitizeMoney(parseIntOrNull(body?.bountyAmount), "Bounty amount");

    if (!itemName && !title) {
      return jsonError("Card or item name is required.");
    }
    if (priceMin === null && priceMax === null) {
      return jsonError("Enter a budget or budget range.");
    }

    const priceBounds = normalizePriceBounds(priceMin, priceMax);
    const notes = clampText(body?.notes, 240);
    const category = clampText(body?.category, 80);
    const player = clampText(body?.player, 120);
    const setName = clampText(body?.setName, 120);
    const year = clampText(body?.year, 12);
    const gradeCompany = clampText(body?.gradeCompany, 32);
    const gradeTarget = clampText(body?.gradeTarget, 32);
    const grade = clampText(body?.grade, 32);
    const condition = clampText(body?.condition, 48);
    const certNumber = clampText(body?.certNumber, 64);

    const created = await prisma.wantRequest.create({
      data: {
        userId: sessionUser.id,
        title: title || itemName,
        itemName: itemName || title,
        category: category || null,
        player: player || null,
        setName: setName || null,
        year: year || null,
        gradeCompany: gradeCompany || null,
        gradeTarget: gradeTarget || null,
        grade: grade || null,
        condition: condition || null,
        certNumber: certNumber || null,
        priceMin: priceBounds.priceMin,
        priceMax: priceBounds.priceMax,
        bountyAmount,
        notes: notes || null,
        imageUrl: toHttpUrlOrNull(body?.imageUrl) ?? null,
        status: "OPEN",
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

    return jsonOk(asListItem(created), { status: 201 });
  } catch (error) {
    if (error instanceof Error && /cannot be negative|exceeds the allowed limit/i.test(error.message)) {
      return jsonError(error.message);
    }
    if (isBountySchemaMissing(error)) {
      return jsonError("Bounties are initializing. Retry in a few seconds.", 503);
    }
    console.error("Bounties POST failed", { error });
    return jsonError("Unable to post bounty right now.", 500);
  }
}
