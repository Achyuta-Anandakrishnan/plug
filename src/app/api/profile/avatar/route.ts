import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { ensureProfileSchema } from "@/lib/profile-schema";
import { getSupabaseServerClient, supabaseEnabled } from "@/lib/supabase";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

function getExtension(fileName: string, contentType: string | null) {
  const fromName = fileName.split(".").pop();
  if (fromName && fromName.length < 6) return fromName.toLowerCase();
  if (contentType?.includes("png")) return "png";
  if (contentType?.includes("jpeg") || contentType?.includes("jpg")) return "jpg";
  if (contentType?.includes("webp")) return "webp";
  return "bin";
}

function detectImageType(buffer: Buffer): "image/png" | "image/jpeg" | "image/webp" | null {
  if (buffer.length >= 8) {
    const pngSig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    if (pngSig.every((byte, index) => buffer[index] === byte)) {
      return "image/png";
    }
  }

  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  if (
    buffer.length >= 12
    && buffer[0] === 0x52
    && buffer[1] === 0x49
    && buffer[2] === 0x46
    && buffer[3] === 0x46
    && buffer[8] === 0x57
    && buffer[9] === 0x45
    && buffer[10] === 0x42
    && buffer[11] === 0x50
  ) {
    return "image/webp";
  }

  return null;
}

export async function POST(request: Request) {
  await ensureProfileSchema().catch(() => null);

  const sessionUser = await getSessionUser();
  if (!sessionUser?.id) {
    return jsonError("Authentication required.", 401);
  }

  if (!supabaseEnabled()) {
    return jsonError("Supabase storage not configured.", 400);
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return jsonError("file is required.");
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return jsonError("Only PNG, JPEG, and WEBP uploads are supported.", 400);
  }

  if (file.size > MAX_BYTES) {
    return jsonError("File too large (max 5MB).", 400);
  }

  const bucket = process.env.SUPABASE_BUCKET || "auction-images";
  const ext = getExtension(file.name, file.type);
  const path = `profiles/${sessionUser.id}/${randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const detectedType = detectImageType(buffer);
  if (!detectedType || detectedType !== file.type) {
    return jsonError("Uploaded file content does not match supported image types.", 400);
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return jsonError("Supabase client not available.", 500);
  }

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, buffer, {
      contentType: file.type,
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
