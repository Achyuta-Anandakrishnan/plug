import { redirect } from "next/navigation";

export default function StreamsPage() {
  redirect("/listings?mode=streams");
}
