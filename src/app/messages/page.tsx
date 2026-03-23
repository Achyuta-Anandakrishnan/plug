import { Suspense } from "react";
import { headers } from "next/headers";
import { MessagesClient } from "@/components/messages/MessagesClient";
import { isProbablyMobileUserAgent } from "@/lib/mobile";

export default async function MessagesPage() {
  const initialIsMobile = isProbablyMobileUserAgent((await headers()).get("user-agent"));

  // useSearchParams is used in the client component, so wrap in Suspense for App Router.
  return (
    <Suspense fallback={null}>
      <MessagesClient initialIsMobile={initialIsMobile} />
    </Suspense>
  );
}
