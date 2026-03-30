import { checkRateLimit, jsonError, jsonOk } from "@/lib/api";
import { getSupabaseServerClient, supabaseEnabled } from "@/lib/supabase";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminEmail } from "@/lib/admin";
import { ALLOWED_IMAGE_TYPES, buildScopedUploadPath, detectImageType, extensionForImageType } from "@/lib/upload-validation";

const UPLOAD_RATE_LIMIT = 24;       // max uploads
const UPLOAD_RATE_WINDOW = 60 * 60 * 1000; // per hour

const MAX_BYTES = 10 * 1024 * 1024;

function normalizeUploadScope(scope: string) {
  if (!scope) return "auctions" as const;
  if (scope === "message" || scope === "messages") return "messages" as const;
  if (scope === "auction" || scope === "auctions") return "auctions" as const;
  return null;
}

export async function POST(request: Request) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return jsonError("Authentication required.", 401);
  }

  // Per-user upload rate limit
  const rateLimitKey = `upload:${sessionUser.id}`;
  const allowed = await checkRateLimit(rateLimitKey, UPLOAD_RATE_LIMIT, UPLOAD_RATE_WINDOW);
  if (!allowed) {
    return jsonError("Upload rate limit reached. Try again later.", 429);
  }

  const requestUrl = new URL(request.url);
  const scope = normalizeUploadScope(requestUrl.searchParams.get("scope")?.trim().toLowerCase() ?? "");
  if (!scope) {
    return jsonError("Invalid upload scope.", 400);
  }
  const isMessageUpload = scope === "messages";

  const isAdmin = isAdminEmail(sessionUser.email);
  if (!isAdmin && !isMessageUpload) {
    const sellerProfile = await prisma.sellerProfile.findUnique({
      where: { userId: sessionUser.id },
      select: { id: true },
    });
    if (!sellerProfile) {
      return jsonError("Only sellers can upload listing images.", 403);
    }
  }

  if (!supabaseEnabled()) {
    return jsonError("Supabase storage not configured.", 400);
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return jsonError("file is required.");
  }

  if (file.size > MAX_BYTES) {
    return jsonError("File too large (max 10MB).", 400);
  }

  const bucket = process.env.SUPABASE_BUCKET || "auction-images";
  const buffer = Buffer.from(await file.arrayBuffer());
  const detectedType = detectImageType(buffer);
  if (!detectedType || !ALLOWED_IMAGE_TYPES.has(file.type) || detectedType !== file.type) {
    return jsonError("Uploaded file content does not match supported image types.", 400);
  }
  const ext = extensionForImageType(detectedType);
  const path = `${buildScopedUploadPath(scope, sessionUser.id)}.${ext}`;

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return jsonError("Supabase client not available.", 500);
  }

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, buffer, {
      contentType: detectedType,
      upsert: false,
    });

  if (error) {
    return jsonError(error.message || "Unable to upload image.", 500);
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  if (!data?.publicUrl) {
    return jsonError("Unable to resolve image URL.", 500);
  }

  return jsonOk({
    url: data.publicUrl,
    storageProvider: "SUPABASE",
    storagePath: path,
    bytes: file.size,
  });
}
