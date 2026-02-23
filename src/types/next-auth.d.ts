import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user?: DefaultSession["user"] & {
      id?: string;
      role?: string;
      email?: string | null;
      username?: string | null;
      displayName?: string | null;
    };
  }

  interface User {
    role?: string;
    username?: string | null;
    displayName?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string;
    userId?: string;
    email?: string | null;
    username?: string | null;
    displayName?: string | null;
    image?: string | null;
  }
}
