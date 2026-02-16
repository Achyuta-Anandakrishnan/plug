import { Suspense } from "react";
import { ForumClient } from "@/components/forum/ForumClient";

export default function ForumPage() {
  return (
    <Suspense fallback={null}>
      <ForumClient />
    </Suspense>
  );
}

