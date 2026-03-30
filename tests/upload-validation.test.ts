import test from "node:test";
import assert from "node:assert/strict";
import { detectImageType, extensionForImageType, isOwnedScopedUploadUrl } from "../src/lib/upload-validation.ts";

test("detectImageType identifies png, jpeg, and webp signatures", () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
  const webp = Buffer.from([
    0x52, 0x49, 0x46, 0x46,
    0x00, 0x00, 0x00, 0x00,
    0x57, 0x45, 0x42, 0x50,
  ]);

  assert.equal(detectImageType(png), "image/png");
  assert.equal(detectImageType(jpeg), "image/jpeg");
  assert.equal(detectImageType(webp), "image/webp");
  assert.equal(extensionForImageType("image/png"), "png");
  assert.equal(extensionForImageType("image/jpeg"), "jpg");
  assert.equal(extensionForImageType("image/webp"), "webp");
});

test("isOwnedScopedUploadUrl only allows the same scoped user path", () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_BUCKET = "auction-images";

  const ownedMessageUrl = "https://example.supabase.co/storage/v1/object/public/auction-images/messages/user_1/file.jpg";
  const otherMessageUrl = "https://example.supabase.co/storage/v1/object/public/auction-images/messages/user_2/file.jpg";
  const wrongScopeUrl = "https://example.supabase.co/storage/v1/object/public/auction-images/trades/user_1/file.jpg";

  assert.equal(isOwnedScopedUploadUrl(ownedMessageUrl, "messages", "user_1"), true);
  assert.equal(isOwnedScopedUploadUrl(otherMessageUrl, "messages", "user_1"), false);
  assert.equal(isOwnedScopedUploadUrl(wrongScopeUrl, "messages", "user_1"), false);
});
