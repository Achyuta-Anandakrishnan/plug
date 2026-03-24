import { redirect } from "next/navigation";

type TradeDisputeRedirectPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ offer?: string }>;
};

export default async function TradeDisputeRedirectPage({ params, searchParams }: TradeDisputeRedirectPageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const suffix = query.offer ? `?offer=${encodeURIComponent(query.offer)}` : "";
  redirect(`/trades/${encodeURIComponent(id)}/duel${suffix}`);
}
