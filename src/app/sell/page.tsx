import { SellerListingQuickForm } from "@/components/sell/SellerListingQuickForm";

export default function SellPage() {
  return (
    <div className="ios-screen">
      <section className="ios-hero space-y-3">
        <p className="ios-kicker">Sell live</p>
        <h1 className="ios-title">Cert-first listing flow.</h1>
        <p className="ios-subtitle">
          Enter a cert number and desired price. Dalow auto-fills the rest.
        </p>
      </section>

      <SellerListingQuickForm />
    </div>
  );
}
