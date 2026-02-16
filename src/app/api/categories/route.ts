import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk, parseJson } from "@/lib/api";
import { requireAdmin } from "@/lib/admin";

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

type CreateCategoryBody = {
  name?: string;
  slug?: string;
};

export async function GET() {
  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
  });

  return jsonOk(categories);
}

export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin.ok) {
    return jsonError(admin.error, admin.status);
  }

  const body = await parseJson<CreateCategoryBody>(request);

  if (!body?.name) {
    return jsonError("Category name is required.");
  }

  const slug = body.slug?.trim() || slugify(body.name);
  if (!slug) {
    return jsonError("Category slug is required.");
  }

  const existing = await prisma.category.findUnique({ where: { slug } });
  if (existing) {
    return jsonError("Category already exists.", 409);
  }

  const category = await prisma.category.create({
    data: {
      name: body.name.trim(),
      slug,
    },
  });

  return jsonOk(category, { status: 201 });
}
