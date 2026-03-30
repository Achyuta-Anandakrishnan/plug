import { prisma } from "@/lib/prisma";
import { checkRateLimit, jsonError, jsonOk } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { getSupabaseServerClient, supabaseEnabled } from "@/lib/supabase";
import { ALLOWED_IMAGE_TYPES, buildScopedUploadPath, detectImageType, extensionForImageType } from "@/lib/upload-validation";

const AVATAR_UPLOAD_RATE_LIMIT = 8;
const AVATAR_UPLOAD_RATE_WINDOW = 60 * 60 * 1000;
const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request) {
  const sessionUser = await getSessionUser();
  if (!sessionUser?.id) {
    return jsonError("Authentication required.", 401);
  }

  const allowed = await checkRateLimit(`upload:avatar:${sessionUser.id}`, AVATAR_UPLOAD_RATE_LIMIT, AVATAR_UPLOAD_RATE_WINDOW);
  if (!allowed) {
    return jsonError("Avatar upload limit reached. Try again later.", 429);
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
    return jsonError("File too large (max 5MB).", 400);
  }

  const bucket = process.env.SUPABASE_BUCKET || "auction-images";
  const buffer = Buffer.from(await file.arrayBuffer());
  const detectedType = detectImageType(buffer);
  if (!detectedType || !ALLOWED_IMAGE_TYPES.has(file.type) || detectedType !== file.type) {
    return jsonError("Uploaded file content does not match supported image types.", 400);
  }
  const ext = extensionForImageType(detectedType);
  const path = `${buildScopedUploadPath("profiles", sessionUser.id)}.${ext}`;

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
    return jsonError(error.message || "Unable to upload avatar.", 500);
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  if (!data?.publicUrl) {
    return jsonError("Unable to resolve avatar URL.", 500);
  }

  const user = await prisma.user.update({
    where: { id: sessionUser.id },
    data: { image: data.publicUrl },
    select: {
      id: true,
      username: true,
      displayName: true,
      bio: true,
      image: true,
    },
  });

  return jsonOk(user);
}
