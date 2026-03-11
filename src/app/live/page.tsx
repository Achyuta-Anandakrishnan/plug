import { redirect } from "next/navigation";

export default function LivePage() {
  redirect("/listings?mode=streams");
}
