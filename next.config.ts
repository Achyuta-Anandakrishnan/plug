import type { NextConfig } from "next";

const supabaseUrl = process.env.SUPABASE_URL;
let supabaseHost: string | null = null;
try {
  if (supabaseUrl) {
    supabaseHost = new URL(supabaseUrl).hostname;
  }
} catch {
  supabaseHost = null;
}

const nextConfig: NextConfig = {
  // Avoid Turbopack inferring the wrong repo root when multiple lockfiles exist on disk.
  turbopack: {
    root: process.cwd(),
  },
  images: {
    remotePatterns: supabaseHost
      ? [
          {
            protocol: "https",
            hostname: supabaseHost,
          },
        ]
      : [],
  },
};

export default nextConfig;
