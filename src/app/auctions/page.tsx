import { redirect } from "next/navigation";

export default function AuctionsPage() {
  redirect("/listings?mode=auctions");
}
