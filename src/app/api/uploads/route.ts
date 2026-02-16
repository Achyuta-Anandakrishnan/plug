import { randomUUID } from "crypto";
import { jsonError, jsonOk } from "@/lib/api";
import { getSupabaseServerClient, supabaseEnabled } from "@/lib/supabase";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminEmail } from "@/lib/admin";

const MAX_BYTES = 10 * 1024 * 1024;

function getExtension(fileName: string, contentType: string | null) {
  const fromName = fileName.split(".").pop();
  if (fromName && fromName.length < 6) return fromName.toLowerCase();
  if (contentType?.includes("png")) return "png";
  if (contentType?.includes("jpeg") || contentType?.includes("jpg")) return "jpg";
  if (contentType?.includes("webp")) return "webp";
  return "bin";
}

export async function POST(request: Request) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return jsonError("Authentication required.", 401);
  }

  const isAdmin = sessionUser.role === "ADMIN" || isAdminEmail(sessionUser.email);
  if (!isAdmin) {
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

  if (!file.type.startsWith("image/")) {
    return jsonError("Only image uploads are supported.", 400);
  }

  if (file.size > MAX_BYTES) {
    return jsonError("File too large (max 10MB).", 400);
  }

  const bucket = process.env.SUPABASE_BUCKET || "auction-images";
  const ext = getExtension(file.name, file.type);
  const path = `auctions/${sessionUser.id}/${randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

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
