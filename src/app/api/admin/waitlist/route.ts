import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api";
import { requireAdmin } from "@/lib/admin";

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin.ok) {
    return jsonError(admin.error, admin.status);
  }

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  const limitParam = Number(searchParams.get("limit") ?? 500);
  const take = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 2000) : 500;

  const entries = await prisma.waitlistEntry.findMany({
    where: q
      ? {
          OR: [
            { email: { contains: q, mode: "insensitive" } },
            { name: { contains: q, mode: "insensitive" } },
            { source: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      email: true,
      name: true,
      source: true,
      createdAt: true,
    },
  });

  return jsonOk(entries);
}
