import { randomUUID } from "crypto";

export const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export function detectImageType(buffer: Buffer): "image/png" | "image/jpeg" | "image/webp" | null {
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

export function extensionForImageType(contentType: "image/png" | "image/jpeg" | "image/webp") {
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  return "jpg";
}

export function buildScopedUploadPath(scope: "messages" | "auctions" | "trades" | "profiles", userId: string) {
  return `${scope}/${userId}/${randomUUID()}`;
}

function getBucketPublicPrefix(bucket: string) {
  const supabaseUrl = (process.env.SUPABASE_URL ?? "").replace(/\/+$/g, "");
  if (!supabaseUrl) return null;
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/`;
}

export function isOwnedScopedUploadUrl(url: string | null | undefined, scope: "messages" | "auctions" | "trades" | "profiles", userId: string) {
  if (!url) return false;
  const bucket = process.env.SUPABASE_BUCKET || "auction-images";
  const prefix = getBucketPublicPrefix(bucket);
  if (!prefix) return false;
  return url.startsWith(`${prefix}${scope}/${userId}/`);
}
