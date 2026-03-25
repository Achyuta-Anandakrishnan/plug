import { Suspense } from "react";
import { MyListingsClient } from "@/components/my/MyListingsClient";

export const dynamic = "force-dynamic";

export default function MyListingsPage() {
  return (
    <Suspense>
      <MyListingsClient />
    </Suspense>
  );
}
