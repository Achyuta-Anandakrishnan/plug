import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { jsonError, jsonOk, parseJson } from "@/lib/api";
import { parseIntOrNull, toHttpUrlOrNull } from "@/lib/trades";
import {
  isWantRequestStatus,
  wantBudgetValue,
  wantSpecificityScore,
  type WantRequestListItem,
  type WantRequestStatus,
} from "@/lib/wants";

type CreateWantBody = {
  title?: string;
  itemName?: string;
  category?: string;
  grade?: string;
  condition?: string;
  certNumber?: string;
  priceMin?: number | string | null;
  priceMax?: number | string | null;
  notes?: string;
  imageUrl?: string;
  status?: WantRequestStatus;
};

type WantGradeFilter = "all" | "raw" | "psa" | "bgs" | "cgc" | "high-grade";
type WantBudgetFilter = "all" | "under-500" | "500-2500" | "2500-10000" | "10000-plus";
type WantSortMode = "newest" | "highest-budget" | "most-specific" | "recently-active";

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
  grade: string | null;
  condition: string | null;
  certNumber: string | null;
  priceMin: number | null;
  priceMax: number | null;
  notes: string | null;
  imageUrl: string | null;
  status: WantRequestStatus;
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: string;
    username: string | null;
    displayName: string | null;
    image: string | null;
  };
}): WantRequestListItem {
  return {
    ...entry,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  };
}

function matchesGradeFilter(entry: WantRequestListItem, filter: WantGradeFilter) {
  if (filter === "all") return true;
  const value = `${entry.grade ?? ""} ${entry.condition ?? ""}`.toLowerCase();
  if (filter === "raw") {
    return value.includes("raw") || value.includes("ungraded") || (!entry.grade && !entry.condition);
  }
  if (filter === "psa") return value.includes("psa");
  if (filter === "bgs") return value.includes("bgs") || value.includes("bvg");
  if (filter === "cgc") return value.includes("cgc") || value.includes("csg") || value.includes("cdc");
  if (filter === "high-grade") return /(10|9|gem|mint)/.test(value);
  return true;
}

function matchesBudgetFilter(entry: WantRequestListItem, filter: WantBudgetFilter) {
  if (filter === "all") return true;
  const budget = wantBudgetValue(entry);
  if (filter === "under-500") return budget > 0 && budget < 50000;
  if (filter === "500-2500") return budget >= 50000 && budget < 250000;
  if (filter === "2500-10000") return budget >= 250000 && budget < 1000000;
  if (filter === "10000-plus") return budget >= 1000000;
  return true;
}

function sortEntries(entries: WantRequestListItem[], sort: WantSortMode) {
  const next = [...entries];
  if (sort === "highest-budget") {
    next.sort((a, b) => wantBudgetValue(b) - wantBudgetValue(a));
    return next;
  }
  if (sort === "most-specific") {
    next.sort((a, b) => {
      const scoreDelta = wantSpecificityScore(b) - wantSpecificityScore(a);
      if (scoreDelta !== 0) return scoreDelta;
      return wantBudgetValue(b) - wantBudgetValue(a);
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
  const searchParams = getSearchParams(request);
  const q = searchParams.get("q")?.trim() ?? "";
  const category = searchParams.get("category")?.trim() ?? "";
  const grade = (searchParams.get("grade")?.trim() ?? "all") as WantGradeFilter;
  const budget = (searchParams.get("budget")?.trim() ?? "all") as WantBudgetFilter;
  const sort = (searchParams.get("sort")?.trim() ?? "newest") as WantSortMode;
  const mine = searchParams.get("mine") === "1";
  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 80), 1), 120);
  const requestedStatus = searchParams.get("status");
  const status = requestedStatus && isWantRequestStatus(requestedStatus) ? requestedStatus : "OPEN";

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
      { notes: { contains: q, mode: "insensitive" } },
      { certNumber: { contains: q, mode: "insensitive" } },
      { category: { contains: q, mode: "insensitive" } },
    ];
  }

  const wants = await prisma.wantRequest.findMany({
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

  const filtered = wants
    .map(asListItem)
    .filter((entry) => matchesGradeFilter(entry, grade))
    .filter((entry) => matchesBudgetFilter(entry, budget));

  return jsonOk(sortEntries(filtered, sort));
}

export async function POST(request: Request) {
  const sessionUser = await getSessionUser();
  if (!sessionUser?.id) {
    return jsonError("Authentication required.", 401);
  }

  const body = await parseJson<CreateWantBody>(request);
  const itemName = normalizeText(body?.itemName);
  const title = normalizeText(body?.title) || itemName;
  const priceMin = parseIntOrNull(body?.priceMin);
  const priceMax = parseIntOrNull(body?.priceMax);

  if (!itemName && !title) {
    return jsonError("Item name is required.");
  }
  if (priceMin === null && priceMax === null) {
    return jsonError("Enter a target price or price range.");
  }

  const priceBounds = normalizePriceBounds(priceMin, priceMax);
  const notes = normalizeText(body?.notes).slice(0, 240);

  const created = await prisma.wantRequest.create({
    data: {
      userId: sessionUser.id,
      title: title || itemName,
      itemName: itemName || title,
      category: normalizeText(body?.category) || null,
      grade: normalizeText(body?.grade) || null,
      condition: normalizeText(body?.condition) || null,
      certNumber: normalizeText(body?.certNumber) || null,
      priceMin: priceBounds.priceMin,
      priceMax: priceBounds.priceMax,
      notes: notes || null,
      imageUrl: toHttpUrlOrNull(body?.imageUrl) ?? null,
      status: body?.status && isWantRequestStatus(body.status) ? body.status : "OPEN",
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
}
