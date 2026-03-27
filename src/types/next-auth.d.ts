import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user?: DefaultSession["user"] & {
      id?: string;
      role?: string;
      accountStatus?: string | null;
      email?: string | null;
      username?: string | null;
      displayName?: string | null;
    };
  }

  interface User {
    role?: string;
    accountStatus?: string | null;
    username?: string | null;
    displayName?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string;
    accountStatus?: string | null;
    userId?: string;
    email?: string | null;
    username?: string | null;
    displayName?: string | null;
    image?: string | null;
  }
}
