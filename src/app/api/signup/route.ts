import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  EMAIL_REGEX,
  checkRateLimit,
  getRequestIp,
  jsonError,
  jsonOk,
  parseJson,
} from "@/lib/api";

type SignupBody = {
  email?: string;
  phone?: string;
  displayName?: string;
  role?: "BUYER" | "SELLER" | "BOTH";
  applyAsSeller?: boolean;
  captchaToken?: string;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function POST(request: Request) {
  const body = await parseJson<SignupBody>(request);

  if (!body?.email) {
    return jsonError("Email is required.");
  }

  const ip = getRequestIp(request);
  const email = normalizeEmail(body.email);

  if (!checkRateLimit(`signup:${ip}`, 10, 60_000)) {
    return jsonError("Too many signup attempts. Try again shortly.", 429);
  }

  if (!EMAIL_REGEX.test(email)) {
    return jsonError("Invalid email.");
  }

  if (process.env.NODE_ENV === "production") {
    const captchaSecret = process.env.TURNSTILE_SECRET_KEY;
    if (captchaSecret && !body.captchaToken) {
      return jsonError("Captcha verification is required.", 400);
    }
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
