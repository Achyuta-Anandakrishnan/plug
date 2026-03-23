import { redirect } from "next/navigation";

export default async function WantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/bounties/${encodeURIComponent(id)}`);
}
