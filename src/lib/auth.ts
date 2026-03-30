import "server-only";
import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth/next";
import { headers } from "next/headers";
import GoogleProvider from "next-auth/providers/google";
import AppleProvider from "next-auth/providers/apple";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { isBlockedAccountStatus, normalizeAccountStatus } from "@/lib/account-status";
import { ensureProfileSchema } from "@/lib/profile-schema";
import { generateUniqueUsername } from "@/lib/username";
import { verifyNativeAuthToken } from "@/lib/native-auth";

const providers = [];
const AUTH_TOKEN_REFRESH_MS = 1000 * 60 * 30;

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
    async signIn({ user, account }) {
      const userId = (user as { id?: string }).id;
      if (!userId || !account) return true;

      await ensureProfileSchema().catch(() => null);

      const dbUser = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          accountStatus: true,
        },
      });
      if (isBlockedAccountStatus(dbUser?.accountStatus)) {
        return false;
      }

      if (account.provider === "google" || account.provider === "apple") {
        await prisma.user.update({
          where: { id: userId },
          data: { emailVerified: new Date() },
        }).catch(() => null);
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.userId =
          (user as { id?: string }).id ??
          (token.userId as string | undefined) ??
          token.sub;
        token.role = (user as { role?: string }).role ?? (token.role as string | undefined);
        token.email = (user as { email?: string }).email ?? (token.email as string | undefined);
        token.accountStatus =
          (user as { accountStatus?: string | null }).accountStatus
          ?? (token.accountStatus as string | undefined)
          ?? "ACTIVE";
        token.displayName =
          (user as { displayName?: string; name?: string }).displayName
          ?? (user as { displayName?: string; name?: string }).name
          ?? (token.displayName as string | undefined);
        token.image =
          (user as { image?: string }).image
          ?? (token.image as string | undefined);
        token.profileSyncedAt = 0;
      }

      const tokenUserId = (token.userId as string | undefined) ?? token.sub;
      const needsProfileData =
        !token.email
        || !token.displayName
        || !token.role
        || !(token.username as string | undefined);
      const lastSyncedAt = typeof token.profileSyncedAt === "number" ? token.profileSyncedAt : 0;
      const needsRefresh = Date.now() - lastSyncedAt > AUTH_TOKEN_REFRESH_MS;
      const shouldHydrateToken = Boolean(tokenUserId && (user || needsProfileData || needsRefresh));

      if (tokenUserId && shouldHydrateToken) {
        await ensureProfileSchema().catch(() => null);
        const dbUser = await prisma.user.findUnique({
          where: { id: tokenUserId },
          select: {
            id: true,
            role: true,
            accountStatus: true,
            email: true,
            username: true,
            displayName: true,
            name: true,
            image: true,
          },
        });

        let resolvedUsername = dbUser?.username ?? null;
        const canWriteProfile = Boolean(user || needsProfileData);

        if (dbUser && !resolvedUsername && canWriteProfile) {
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
            resolvedUsername = nextUsername;
          } catch {
            // Ignore race conflicts and keep auth flow alive.
          }
        }

        const resolvedEmail = dbUser?.email ?? (token.email as string | undefined);

        token.role = dbUser?.role ?? (token.role as string | undefined);
        token.email = resolvedEmail;
        token.accountStatus = normalizeAccountStatus(dbUser?.accountStatus ?? (token.accountStatus as string | undefined));
        token.username = resolvedUsername ?? (token.username as string | undefined);
        token.displayName = dbUser?.displayName ?? dbUser?.name ?? (token.displayName as string | undefined);
        token.image = dbUser?.image ?? (token.image as string | undefined);
        token.profileSyncedAt = Date.now();
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { role?: string; id?: string }).role = token.role as string;
        (session.user as { role?: string; id?: string }).id =
          (token.userId as string) ?? token.sub ?? "";
        (session.user as { accountStatus?: string | null }).accountStatus =
          normalizeAccountStatus(token.accountStatus as string | undefined);
        (session.user as { username?: string | null }).username = (token.username as string | undefined) ?? null;
        (session.user as { displayName?: string | null }).displayName = (token.displayName as string | undefined) ?? null;
        session.user.email = (token.email as string) ?? session.user.email ?? null;
        session.user.image = (token.image as string) ?? session.user.image ?? null;
      }
      return session;
    },
  },
};

async function getNativeBearerSessionUser() {
  try {
    const headerStore = await headers();
    const authHeader = headerStore.get("authorization") ?? "";
    if (!authHeader.toLowerCase().startsWith("bearer ")) {
      return null;
    }

    const token = authHeader.slice(7).trim();
    const payload = verifyNativeAuthToken(token);
    if (!payload?.sub) {
      return null;
    }

    await ensureProfileSchema().catch(() => null);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        role: true,
        accountStatus: true,
        email: true,
        username: true,
      },
    });
    if (!user) return null;
    if (isBlockedAccountStatus(user.accountStatus)) return null;

    return {
      id: user.id,
      role: user.role ?? null,
      email: user.email ?? null,
      username: user.username ?? null,
      accountStatus: normalizeAccountStatus(user.accountStatus),
    };
  } catch {
    return null;
  }
}

export async function getSessionUser() {
  const nativeUser = await getNativeBearerSessionUser();
  if (nativeUser) {
    return nativeUser;
  }

  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string; username?: string } | undefined;
  if (!user?.id) return null;
  if (isBlockedAccountStatus((user as { accountStatus?: string | null }).accountStatus)) {
    return null;
  }
  return {
    id: user.id,
    role: user.role ?? null,
    email: session?.user?.email ?? null,
    username: user.username ?? null,
    accountStatus: normalizeAccountStatus((user as { accountStatus?: string | null }).accountStatus),
  };
}
