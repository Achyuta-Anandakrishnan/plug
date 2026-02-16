import { Suspense } from "react";
import { ForumPostClient } from "@/components/forum/ForumPostClient";

export default function ForumPostPage() {
  return (
    <Suspense fallback={null}>
      <ForumPostClient />
    </Suspense>
  );
}

