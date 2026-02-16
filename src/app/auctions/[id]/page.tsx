import { redirect } from "next/navigation";

export default function AuctionRoom({ params }: { params: { id: string } }) {
  redirect(`/streams/${params.id}`);
}
