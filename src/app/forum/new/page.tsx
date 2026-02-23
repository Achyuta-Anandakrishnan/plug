import { Suspense } from "react";
import { ForumComposeClient } from "@/components/forum/ForumComposeClient";

export default function ForumComposePage() {
  return (
    <Suspense fallback={null}>
      <ForumComposeClient />
    </Suspense>
  );
}
