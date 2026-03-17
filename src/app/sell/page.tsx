import { SellerListingQuickForm } from "@/components/sell/SellerListingQuickForm";
import { DiscoveryBar, FormContainer, PageContainer, SecondaryButton } from "@/components/product/ProductUI";

export default function SellPage() {
  return (
    <PageContainer className="sell-page app-page--sell">
      <section className="app-section">
        <DiscoveryBar className="app-control-bar sell-toolbar">
          <div className="app-control-title">Create listing</div>
          <div className="sell-toolbar-note">Cert-first flow. Verify the slab, set price, publish fast.</div>
          <SecondaryButton href="/listings">Back to market</SecondaryButton>
        </DiscoveryBar>
        <FormContainer>
          <SellerListingQuickForm />
        </FormContainer>
      </section>
    </PageContainer>
  );
}
