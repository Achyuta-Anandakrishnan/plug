import { jsonError, jsonOk } from "@/lib/api";
import { expireAuctions } from "@/lib/server/auction-expiry";

function isAuthorized(request: Request) {
  const configuredSecret = process.env.CRON_SECRET?.trim();
  if (!configuredSecret) return false;

  const bearer = request.headers.get("authorization")?.trim() ?? "";
  if (bearer === `Bearer ${configuredSecret}`) return true;

  const url = new URL(request.url);
  return url.searchParams.get("secret") === configuredSecret;
}

async function run(request: Request) {
  if (!isAuthorized(request)) {
    return jsonError("Not authorized.", 401);
  }

  const result = await expireAuctions();
  return jsonOk(result);
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
