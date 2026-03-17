import { jsonError, jsonOk } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendVerificationEmailForUser } from "@/lib/email-verification";

export async function POST() {
  const sessionUser = await getSessionUser();
  if (!sessionUser?.id || !sessionUser.email) {
    return jsonError("Authentication required.", 401);
  }

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: {
      id: true,
      email: true,
      emailVerified: true,
    },
  });

  if (!user?.email) {
    return jsonError("No email found for this account.", 400);
  }

  if (user.emailVerified) {
    return jsonOk({ sent: false, alreadyVerified: true });
  }

  const sent = await sendVerificationEmailForUser({
    userId: user.id,
    email: user.email,
  });

  return jsonOk({ sent });
}
