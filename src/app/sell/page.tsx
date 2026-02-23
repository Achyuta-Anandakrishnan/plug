import { SellerListingDesktop } from "@/components/sell/SellerListingDesktop";
import { SellerListingMobile } from "@/components/sell/SellerListingMobile";

export default function SellPage() {
  return (
    <>
      <div className="md:hidden">
        <SellerListingMobile />
      </div>
      <div className="hidden md:block">
        <SellerListingDesktop />
      </div>
    </>
  );
}
