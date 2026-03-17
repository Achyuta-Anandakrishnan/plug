import Link from "next/link";
import { SellerListingQuickForm } from "@/components/sell/SellerListingQuickForm";
import { FormContainer, PageContainer, PageHeader, SecondaryButton } from "@/components/product/ProductUI";

function normalizeMode(value: string | undefined) {
  if (value === "BUY_NOW" || value === "BOTH") return value;
  return "AUCTION";
}

export default async function SellPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const params = await searchParams;
  const mode = normalizeMode(params.mode);

  return (
    <PageContainer className="sell-page app-page--sell">
      <section className="app-section">
        <PageHeader
          title="Create listing"
          subtitle="Verify the item once, then branch into the right listing mode."
          actions={<SecondaryButton href="/listings">Back to market</SecondaryButton>}
        />
        <nav className="listing-flow-strip" aria-label="Listing modes">
          <Link href="/sell?mode=AUCTION" className={`listing-flow-link ${mode === "AUCTION" ? "is-active" : ""}`}>Auction</Link>
          <Link href="/sell?mode=BUY_NOW" className={`listing-flow-link ${mode === "BUY_NOW" ? "is-active" : ""}`}>Buy now</Link>
          <Link href="/sell?mode=BOTH" className={`listing-flow-link ${mode === "BOTH" ? "is-active" : ""}`}>Auction + buy now</Link>
          <Link href="/trades/new" className="listing-flow-link">Trade</Link>
        </nav>
        <FormContainer>
          <SellerListingQuickForm />
        </FormContainer>
      </section>
    </PageContainer>
  );
}
