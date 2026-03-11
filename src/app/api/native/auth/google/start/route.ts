import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import {
  getAppOrigin,
  sanitizeNativeRedirectUri,
  signGoogleNativeState,
} from "@/lib/native-google-oauth";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

export async function GET(request: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const appOrigin = getAppOrigin(request.url);

  if (!clientId || !clientSecret) {
    return jsonError("Google auth is not configured on the server.", 503);
  }
  if (!appOrigin) {
    return jsonError("NEXTAUTH_URL or NEXT_PUBLIC_APP_URL must be configured.", 500);
  }

  const incoming = new URL(request.url);
  const redirectUri = sanitizeNativeRedirectUri(incoming.searchParams.get("redirect_uri"));
  const callbackUrl = `${appOrigin}/api/native/auth/google/callback`;

  const stateToken = signGoogleNativeState({
    redirectUri,
    nonce: randomUUID(),
    exp: Math.floor(Date.now() / 1000) + 60 * 10,
  });

  const authUrl = new URL(GOOGLE_AUTH_URL);
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", callbackUrl);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "openid email profile");
  authUrl.searchParams.set("state", stateToken);
  authUrl.searchParams.set("prompt", "select_account");
  authUrl.searchParams.set("access_type", "offline");

  return NextResponse.redirect(authUrl);
}
