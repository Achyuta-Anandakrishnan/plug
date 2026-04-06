"use client";

import { useEffect, useState } from "react";
import { useSession, signIn } from "next-auth/react";
import {
  FormContainer,
  PageContainer,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
} from "@/components/product/ProductUI";

type CustomerStatus = {
  stripeConfigured: boolean;
  hasPaymentMethod: boolean;
};

type ConnectStatus = {
  hasSellerProfile: boolean;
  stripeConfigured: boolean;
  stripeAccountId: string | null;
  payoutsEnabled: boolean;
  sellerStatus: string | null;
  sellerState?: "not_started" | "onboarding" | "restricted" | "active" | "payouts_disabled";
};

export default function PaymentsSettingsPage() {
  const { data: session } = useSession();
  const [customer, setCustomer] = useState<CustomerStatus | null>(null);
  const [connect, setConnect] = useState<ConnectStatus | null>(null);
  const [buyerStatus, setBuyerStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [sellerStatus, setSellerStatus] = useState<"idle" | "loading" | "error">("idle");
  const [buyerMsg, setBuyerMsg] = useState("");
  const [sellerMsg, setSellerMsg] = useState("");

  useEffect(() => {
    if (!session?.user?.id) return;
    void fetch("/api/stripe/customer").then((r) => r.json()).then(setCustomer);
    void fetch("/api/stripe/connect").then((r) => r.json()).then(setConnect);
  }, [session?.user?.id]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const setup = params.get("setup");
    if (setup === "success") {
      setBuyerStatus("done");
      setBuyerMsg("Payment method added successfully.");
      void fetch("/api/stripe/customer").then((r) => r.json()).then(setCustomer);
    } else if (setup === "cancel") {
      setBuyerStatus("idle");
      setBuyerMsg("Payment setup was cancelled.");
    }
  }, []);

  if (!session?.user?.id) {
    return (
      <PageContainer>
        <PageHeader title="Payments" />
        <FormContainer>
          <p className="app-status-note">Sign in to manage your payment settings.</p>
          <PrimaryButton onClick={() => void signIn()}>Sign in</PrimaryButton>
        </FormContainer>
      </PageContainer>
    );
  }

  const handleSetupBuyer = async () => {
    setBuyerStatus("loading");
    setBuyerMsg("");
    try {
      const res = await fetch("/api/stripe/customer", { method: "POST" });
      const data = (await res.json()) as { hasPaymentMethod?: boolean; setupUrl?: string; error?: string };
      if (!res.ok) throw new Error(data.error || "Unable to set up payments.");
      if (data.hasPaymentMethod) {
        setBuyerStatus("done");
        setBuyerMsg("Payment account already set up.");
        setCustomer((prev) => prev ? { ...prev, hasPaymentMethod: true } : prev);
        return;
      }
      if (data.setupUrl) {
        window.location.assign(data.setupUrl);
        return;
      }
      throw new Error("Unable to start payment setup.");
    } catch (err) {
      setBuyerStatus("error");
      setBuyerMsg(err instanceof Error ? err.message : "Something went wrong.");
    }
  };

  const handleConnectSeller = async () => {
    setSellerStatus("loading");
    setSellerMsg("");
    try {
      const res = await fetch("/api/stripe/connect", { method: "POST" });
      const data = (await res.json()) as { url?: string; redirectPath?: string; error?: string };
      if (!res.ok || (!data.redirectPath && !data.url)) {
        throw new Error(data.error || "Unable to start Stripe onboarding.");
      }
      const target = typeof data.redirectPath === "string" && data.redirectPath.trim()
        ? data.redirectPath.trim()
        : data.url!;
      window.location.assign(target);
    } catch (err) {
      setSellerStatus("error");
      setSellerMsg(err instanceof Error ? err.message : "Something went wrong.");
    }
  };

  const sellerReady = connect?.sellerState === "active";
  const sellerNeedsStripe = connect?.sellerState === "payouts_disabled";
  const sellerNeedsApproval = connect?.sellerState === "onboarding";
  const sellerRestricted = connect?.sellerState === "restricted";

  return (
    <PageContainer>
      <PageHeader title="Payments" />

      <FormContainer>
        {/* ── Buyer payments ── */}
        <section className="app-form-section">
          <h3 className="app-form-subheader">Buyer payments</h3>
          <p className="app-status-note" style={{ marginBottom: 12 }}>
            Required to place bids or make cash offers on trades.
          </p>

          {customer?.hasPaymentMethod ? (
            <p className="app-status-note is-success">Payment account connected.</p>
          ) : (
            <>
              <PrimaryButton
                onClick={() => void handleSetupBuyer()}
                disabled={buyerStatus === "loading" || !customer?.stripeConfigured}
              >
                {buyerStatus === "loading" ? "Setting up…" : "Set up payment account"}
              </PrimaryButton>
              {!customer?.stripeConfigured && (
                <p className="app-status-note is-warning" style={{ marginTop: 8 }}>
                  Payments are not configured on this platform.
                </p>
              )}
            </>
          )}
          {buyerMsg && (
            <p className={`app-status-note${buyerStatus === "error" ? " is-error" : " is-success"}`} style={{ marginTop: 8 }}>
              {buyerMsg}
            </p>
          )}
        </section>

        {/* ── Seller payouts (only if has seller profile) ── */}
        {connect?.hasSellerProfile && (
          <section className="app-form-section" style={{ marginTop: 24, borderTop: "1px solid var(--product-border)", paddingTop: 24 }}>
            <h3 className="app-form-subheader">Seller payouts</h3>
            <p className="app-status-note" style={{ marginBottom: 12 }}>
              Required to create listings and receive payments from sales.
            </p>

            {sellerReady ? (
              <>
                <p className="app-status-note is-success">Stripe account connected. Payouts enabled.</p>
                <SecondaryButton
                  onClick={() => void handleConnectSeller()}
                  disabled={sellerStatus === "loading"}
                  style={{ marginTop: 10 }}
                >
                  Update Stripe account
                </SecondaryButton>
              </>
            ) : (
              <>
                <PrimaryButton
                  onClick={() => void handleConnectSeller()}
                  disabled={sellerStatus === "loading" || !connect.stripeConfigured}
                >
                  {sellerStatus === "loading" ? "Redirecting…" : connect.stripeAccountId ? "Complete Stripe setup" : "Connect Stripe for payouts"}
                </PrimaryButton>
                {sellerNeedsStripe && connect.stripeAccountId && (
                  <p className="app-status-note is-warning" style={{ marginTop: 8 }}>
                    Your Stripe account needs more information before payouts are enabled.
                  </p>
                )}
                {sellerNeedsApproval && (
                  <p className="app-status-note is-warning" style={{ marginTop: 8 }}>
                    Seller verification is still under review. You can finish Stripe onboarding now, but selling stays gated until approval.
                  </p>
                )}
                {sellerRestricted && (
                  <p className="app-status-note is-error" style={{ marginTop: 8 }}>
                    Seller access is restricted. Payouts remain blocked until support resolves the account state.
                  </p>
                )}
              </>
            )}
            {sellerMsg && (
              <p className={`app-status-note${sellerStatus === "error" ? " is-error" : ""}`} style={{ marginTop: 8 }}>
                {sellerMsg}
              </p>
            )}
          </section>
        )}
      </FormContainer>
    </PageContainer>
  );
}
