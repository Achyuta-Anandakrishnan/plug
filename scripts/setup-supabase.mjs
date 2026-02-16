import { execSync } from "child_process";
import dns from "dns/promises";
import { createClient } from "@supabase/supabase-js";

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name} in environment.`);
  }
  return value;
}

function run(cmd) {
  execSync(cmd, { stdio: "inherit" });
}

async function ensurePrismaCanReachDirectUrl() {
  const databaseUrl = requireEnv("DATABASE_URL");
  const directUrl = requireEnv("DIRECT_URL");

  let directHost = null;
  try {
    directHost = new URL(directUrl).hostname;
  } catch {
    directHost = null;
  }

  if (!directHost) {
    console.warn("DIRECT_URL is not a valid URL. Falling back to DATABASE_URL for migrations.");
    process.env.DIRECT_URL = databaseUrl;
    return;
  }

  try {
    await dns.lookup(directHost);
  } catch {
    console.warn(
      `DIRECT_URL host not resolvable (${directHost}). Falling back to DATABASE_URL for migrations.`,
    );
    process.env.DIRECT_URL = databaseUrl;
  }
}

async function ensureStorageBucket() {
  const supabaseUrl = requireEnv("SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const bucket = process.env.SUPABASE_BUCKET || "auction-images";

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) throw new Error(`Supabase listBuckets failed: ${listError.message}`);

  const existing = buckets.find((b) => b.name === bucket) ?? null;
  if (!existing) {
    const { error: createError } = await supabase.storage.createBucket(bucket, {
      public: true,
      fileSizeLimit: "10MB",
      allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"],
    });
    if (createError) throw new Error(`Supabase createBucket failed: ${createError.message}`);
    console.log(`Storage bucket created: ${bucket} (public)`);
    return;
  }

  if (!existing.public) {
    const { error: updateError } = await supabase.storage.updateBucket(bucket, {
      public: true,
    });
    if (updateError) throw new Error(`Supabase updateBucket failed: ${updateError.message}`);
    console.log(`Storage bucket updated: ${bucket} (set public)`);
  } else {
    console.log(`Storage bucket ok: ${bucket} (public)`);
  }
}

async function main() {
  // Node 20+ supports `--env-file=.env`. Prefer invoking via package.json script:
  // `node --env-file=.env scripts/setup-supabase.mjs`
  requireEnv("DATABASE_URL");
  requireEnv("DIRECT_URL");

  console.log("Applying Prisma migrations to Supabase...");
  await ensurePrismaCanReachDirectUrl();
  run("npx prisma migrate deploy");
  run("npx prisma generate");

  console.log("Ensuring Supabase storage bucket exists...");
  await ensureStorageBucket();

  console.log("Supabase setup complete.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
