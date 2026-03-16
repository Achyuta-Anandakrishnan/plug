import Link from "next/link";
import { AppContainer } from "@/components/product/ProductUI";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <AppContainer className="site-footer-row">
        <div className="site-footer-brand">
          <strong>dalow</strong>
          <span>For collectors, by collectors.</span>
        </div>
        <div className="site-footer-links">
          <Link href="/live">Live</Link>
          <Link href="/listings">Market</Link>
          <Link href="/trades">Trades</Link>
          <Link href="/forum">Forum</Link>
        </div>
        <p className="site-footer-copy">© 2026 dalow Labs</p>
      </AppContainer>
    </footer>
  );
}
