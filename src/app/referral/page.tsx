import { ReferralBar } from "@/components/settings/ReferralBar";
import { FormContainer, PageContainer, PageHeader } from "@/components/product/ProductUI";

export default function ReferralPage() {
  return (
    <PageContainer className="referral-page app-page--referral">
      <section className="app-section">
        <FormContainer>
          <PageHeader
            title="Referral"
            subtitle="Invite trusted collectors and share one clean signup link."
          />
          <ReferralBar />
        </FormContainer>
      </section>
    </PageContainer>
  );
}
