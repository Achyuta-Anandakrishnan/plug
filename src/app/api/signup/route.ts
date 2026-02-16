import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk, parseJson } from "@/lib/api";

type SignupBody = {
  email?: string;
  phone?: string;
  displayName?: string;
  role?: "BUYER" | "SELLER" | "BOTH";
  applyAsSeller?: boolean;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function POST(request: Request) {
  const body = await parseJson<SignupBody>(request);

  if (!body?.email) {
    return jsonError("Email is required.");
  }

  const email = normalizeEmail(body.email);
  if (!email.includes("@")) {
    return jsonError("Invalid email.");
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return jsonError("User already exists.", 409);
  }

  const wantsSeller = body.role === "SELLER" || body.role === "BOTH" || body.applyAsSeller;
  // Users are buyers by default. Selling privileges come from an APPROVED seller profile.
  const role = UserRole.BUYER;

  const displayName = body.displayName?.trim();
  const user = await prisma.user.create({
    data: {
      email,
      phone: body.phone?.trim(),
      displayName,
      name: displayName,
      role,
      sellerProfile: wantsSeller
        ? {
          create: {
            status: "APPLIED",
          },
        }
        : undefined,
    },
  });

  return jsonOk(user, { status: 201 });
}
