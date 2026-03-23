import { Suspense } from "react";
import { headers } from "next/headers";
import { ForumClient } from "@/components/forum/ForumClient";
import { isProbablyMobileUserAgent } from "@/lib/mobile";

export default async function ForumPage() {
  const initialIsMobile = isProbablyMobileUserAgent((await headers()).get("user-agent"));

  return (
    <Suspense fallback={null}>
      <ForumClient initialIsMobile={initialIsMobile} />
    </Suspense>
  );
}
