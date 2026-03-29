import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureWaitlistSchema, isWaitlistSchemaMissing } from "@/lib/waitlist-schema";

type WaitlistBody = { email?: string; name?: string };

function parseSubmission(body: WaitlistBody) {
  const email = (body.email ?? "").trim().toLowerCase();
  const name = (body.name ?? "").trim() || null;
  return { email, name };
}

async function upsertWaitlistEntry(body: WaitlistBody) {
  const { email, name } = parseSubmission(body);

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  const entry = await prisma.waitlistEntry.upsert({
    where: { email },
    update: { name: name ?? undefined },
    create: { email, name, source: "landing" },
  });

  return NextResponse.json({ success: true, id: entry.id });
}

export async function POST(request: Request) {
  const requestClone = request.clone();

  try {
    const body = (await request.json()) as WaitlistBody;
    await ensureWaitlistSchema();
    return await upsertWaitlistEntry(body);
  } catch (error) {
    if (isWaitlistSchemaMissing(error)) {
      try {
        const body = (await requestClone.json()) as WaitlistBody;
        await ensureWaitlistSchema();
        return await upsertWaitlistEntry(body);
      } catch {
        return NextResponse.json({ error: "Waitlist is still initializing. Please retry." }, { status: 503 });
      }
    }

    return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 500 });
  }
}
