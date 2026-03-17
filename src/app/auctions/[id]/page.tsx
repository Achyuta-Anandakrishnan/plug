import { redirect } from "next/navigation";

export default async function AuctionRoom({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/streams/${id}`);
}
