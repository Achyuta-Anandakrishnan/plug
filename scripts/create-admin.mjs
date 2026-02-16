import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const args = process.argv.slice(2);
const emailArgIndex = args.findIndex((arg) => arg === "--email");
const nameArgIndex = args.findIndex((arg) => arg === "--name");

const email = emailArgIndex >= 0 ? args[emailArgIndex + 1] : null;
const name = nameArgIndex >= 0 ? args[nameArgIndex + 1] : null;

if (!email) {
  console.error("Usage: node scripts/create-admin.mjs --email you@example.com --name 'Admin'");
  process.exit(1);
}

const normalizedEmail = email.trim().toLowerCase();

const displayName = name ?? "Admin";
const user = await prisma.user.upsert({
  where: { email: normalizedEmail },
  update: { role: "ADMIN", displayName, name: displayName },
  create: {
    email: normalizedEmail,
    displayName,
    name: displayName,
    role: "ADMIN",
  },
});

console.log(`Admin ready: ${user.email} (${user.id})`);

await prisma.$disconnect();
