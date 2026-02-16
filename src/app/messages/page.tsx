import { Suspense } from "react";
import { MessagesClient } from "@/components/messages/MessagesClient";

export default function MessagesPage() {
  // useSearchParams is used in the client component, so wrap in Suspense for App Router.
  return (
    <Suspense fallback={null}>
      <MessagesClient />
    </Suspense>
  );
}

