import { SellerListingDesktop } from "@/components/sell/SellerListingDesktop";
import { SellerListingMobile } from "@/components/sell/SellerListingMobile";

export default function SellPage() {
  return (
    <div className="ios-screen">
      <section className="ios-hero space-y-3">
        <p className="ios-kicker">Sell live</p>
        <h1 className="ios-title">Build a listing worth showing live.</h1>
        <p className="ios-subtitle">
          Clean inventory, clear pricing, strong media, and a better presentation
          the moment buyers land in the room.
        </p>
      </section>

      <div className="md:hidden">
        <SellerListingMobile />
      </div>
      <div className="hidden md:block">
        <SellerListingDesktop />
      </div>
    </div>
  );
}
