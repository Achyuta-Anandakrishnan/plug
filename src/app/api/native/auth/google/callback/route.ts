import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureProfileSchema } from "@/lib/profile-schema";
import { generateUniqueUsername } from "@/lib/username";
import { signNativeAuthToken } from "@/lib/native-auth";
import {
  DEFAULT_NATIVE_REDIRECT,
  getAppOrigin,
  sanitizeNativeRedirectUri,
  verifyGoogleNativeState,
} from "@/lib/native-google-oauth";

type GoogleTokenResponse = {
  access_token?: string;
  id_token?: string;
  error?: string;
};

type GoogleTokenInfo = {
  aud?: string;
  email?: string;
  email_verified?: string;
  name?: string;
  picture?: string;
};

function buildNativeRedirect(target: string, params: Record<string, string>) {
  const url = new URL(sanitizeNativeRedirectUri(target));
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  await ensureProfileSchema().catch(() => null);

  const appOrigin = getAppOrigin(request.url);
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!appOrigin || !clientId || !clientSecret) {
    return buildNativeRedirect(DEFAULT_NATIVE_REDIRECT, {
      error: "Google auth is not configured correctly.",
    });
  }

  const incoming = new URL(request.url);
  const code = incoming.searchParams.get("code");
  const state = verifyGoogleNativeState(incoming.searchParams.get("state"));
  const nativeRedirect = state?.redirectUri ?? DEFAULT_NATIVE_REDIRECT;

  if (!code || !state) {
    return buildNativeRedirect(nativeRedirect, {
      error: "Google sign-in response was invalid.",
    });
  }

  try {
    const callbackUrl = `${appOrigin}/api/native/auth/google/callback`;
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: callbackUrl,
      }).toString(),
      cache: "no-store",
    });

    const tokenPayload = (await tokenResponse.json()) as GoogleTokenResponse;
    if (!tokenResponse.ok || !tokenPayload.id_token) {
      return buildNativeRedirect(nativeRedirect, {
        error: tokenPayload.error || "Unable to exchange Google code.",
      });
    }

    const tokenInfoResponse = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(tokenPayload.id_token)}`,
      { cache: "no-store" },
    );

    const tokenInfo = (await tokenInfoResponse.json()) as GoogleTokenInfo;
    if (!tokenInfoResponse.ok || !tokenInfo.email) {
      return buildNativeRedirect(nativeRedirect, {
        error: "Unable to verify Google account.",
      });
    }

    const aud = tokenInfo.aud ?? "";
    if (aud !== clientId) {
      return buildNativeRedirect(nativeRedirect, {
        error: "Google token audience mismatch.",
      });
    }

    if ((tokenInfo.email_verified ?? "").toLowerCase() !== "true") {
      return buildNativeRedirect(nativeRedirect, {
        error: "Google account email must be verified.",
      });
    }

    const email = tokenInfo.email.trim().toLowerCase();
    const displayName = tokenInfo.name?.trim() || email.split("@")[0] || "Collector";

    const user = await prisma.user.upsert({
      where: { email },
      update: {
        displayName,
        name: displayName,
        image: tokenInfo.picture || undefined,
      },
      create: {
        email,
        displayName,
        name: displayName,
        image: tokenInfo.picture || undefined,
        role: UserRole.BUYER,
      },
      select: {
        id: true,
        email: true,
        role: true,
        username: true,
      },
    });

    let username = user.username;
    if (!username) {
      const generated = await generateUniqueUsername(prisma, displayName || email.split("@")[0], user.id);
      try {
        const updated = await prisma.user.update({
          where: { id: user.id },
          data: { username: generated },
          select: { username: true },
        });
        username = updated.username;
      } catch {
        // Ignore concurrent username races.
      }
    }

    const token = signNativeAuthToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    return buildNativeRedirect(nativeRedirect, {
      token,
      provider: "google",
      username: username ?? "",
    });
  } catch {
    return buildNativeRedirect(nativeRedirect, {
      error: "Unable to complete Google sign-in.",
    });
  }
}
