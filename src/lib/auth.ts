import "server-only";
import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth/next";
import GoogleProvider from "next-auth/providers/google";
import AppleProvider from "next-auth/providers/apple";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { getConfiguredAdminEmails, isConfiguredAdminEmail } from "@/lib/admin-email";
import { ensureProfileSchema } from "@/lib/profile-schema";
import { generateUniqueUsername } from "@/lib/username";

const providers = [];
const adminEmails = getConfiguredAdminEmails();

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  );
}

if (process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET) {
  providers.push(
    AppleProvider({
      clientId: process.env.APPLE_CLIENT_ID,
      clientSecret: process.env.APPLE_CLIENT_SECRET,
    }),
  );
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers,
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/signin",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId =
          (user as { id?: string }).id ??
          (token.userId as string | undefined) ??
          token.sub;
        token.role = (user as { role?: string }).role ?? (token.role as string | undefined);
        token.email = (user as { email?: string }).email ?? (token.email as string | undefined);
        token.displayName =
          (user as { displayName?: string; name?: string }).displayName
          ?? (user as { displayName?: string; name?: string }).name
          ?? (token.displayName as string | undefined);
        token.image =
          (user as { image?: string }).image
          ?? (token.image as string | undefined);
      }

      const tokenUserId = (token.userId as string | undefined) ?? token.sub;
      if (tokenUserId) {
        await ensureProfileSchema().catch(() => null);
        const dbUser = await prisma.user.findUnique({
          where: { id: tokenUserId },
          select: {
            id: true,
            role: true,
            email: true,
            username: true,
            displayName: true,
            name: true,
            image: true,
          },
        });

        if (dbUser && !dbUser.username) {
          const seed =
            dbUser.displayName
            ?? dbUser.name
            ?? dbUser.email?.split("@")[0]
            ?? `user_${dbUser.id.slice(-6)}`;
          const nextUsername = await generateUniqueUsername(prisma, seed, dbUser.id);
          try {
            await prisma.user.update({
              where: { id: dbUser.id },
              data: { username: nextUsername },
            });
            dbUser.username = nextUsername;
          } catch {
            // Ignore race conflicts and keep auth flow alive.
          }
        }

        if (dbUser?.role) {
          token.role = dbUser.role;
        }
        if (dbUser?.email) {
          token.email = dbUser.email;
        }
        if (dbUser?.username) {
          token.username = dbUser.username;
        }
        token.displayName = dbUser?.displayName ?? dbUser?.name ?? (token.displayName as string | undefined);
        token.image = dbUser?.image ?? (token.image as string | undefined);

        if (isConfiguredAdminEmail(dbUser?.email ?? (token.email as string), adminEmails)) {
          token.role = "ADMIN";
          if (dbUser?.role !== "ADMIN") {
            await prisma.user.update({
              where: { id: tokenUserId },
              data: { role: "ADMIN" },
            });
          }
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { role?: string; id?: string }).role = token.role as string;
        (session.user as { role?: string; id?: string }).id =
          (token.userId as string) ?? token.sub ?? "";
        (session.user as { username?: string | null }).username = (token.username as string | undefined) ?? null;
        (session.user as { displayName?: string | null }).displayName = (token.displayName as string | undefined) ?? null;
        session.user.email = (token.email as string) ?? session.user.email ?? null;
        session.user.image = (token.image as string) ?? session.user.image ?? null;
      }
      return session;
    },
  },
};

export async function getSessionUser() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string; username?: string } | undefined;
  if (!user?.id) return null;
  return {
    id: user.id,
    role: user.role ?? null,
    email: session?.user?.email ?? null,
    username: user.username ?? null,
  };
}
