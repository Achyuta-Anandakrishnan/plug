import "server-only";
import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth/next";
import GoogleProvider from "next-auth/providers/google";
import AppleProvider from "next-auth/providers/apple";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { getConfiguredAdminEmails, isConfiguredAdminEmail } from "@/lib/admin-email";

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
      }

      const tokenUserId = (token.userId as string | undefined) ?? token.sub;
      if (tokenUserId) {
        const dbUser = await prisma.user.findUnique({
          where: { id: tokenUserId },
          select: { role: true, email: true },
        });
        if (dbUser?.role) {
          token.role = dbUser.role;
        }
        if (dbUser?.email) {
          token.email = dbUser.email;
        }

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
        session.user.email = (token.email as string) ?? session.user.email ?? null;
      }
      return session;
    },
  },
};

export async function getSessionUser() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id) return null;
  return { id: user.id, role: user.role ?? null, email: session?.user?.email ?? null };
}
