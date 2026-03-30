import { checkRateLimit, jsonError, jsonOk } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { getSupabaseServerClient, supabaseEnabled } from "@/lib/supabase";
import { ALLOWED_IMAGE_TYPES, buildScopedUploadPath, detectImageType, extensionForImageType } from "@/lib/upload-validation";

const UPLOAD_RATE_LIMIT = 16;
const UPLOAD_RATE_WINDOW = 60 * 60 * 1000;
const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(request: Request) {
  const sessionUser = await getSessionUser();
  if (!sessionUser?.id) {
    return jsonError("Authentication required.", 401);
  }

  const allowed = await checkRateLimit(`upload:trade:${sessionUser.id}`, UPLOAD_RATE_LIMIT, UPLOAD_RATE_WINDOW);
  if (!allowed) {
    return jsonError("Trade image upload limit reached. Try again later.", 429);
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
  const path = `${buildScopedUploadPath("trades", sessionUser.id)}.${ext}`;

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
    storagePath: path,
    bytes: file.size,
  });
}
