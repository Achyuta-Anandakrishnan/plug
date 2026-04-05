"use client";

import { useEffect, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import {
  FormContainer,
  PageContainer,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
} from "@/components/product/ProductUI";

export default function SellerVerificationPage() {
  const { data: session } = useSession();
  const [connect, setConnect] = useState<{
    hasSellerProfile: boolean;
    stripeConfigured: boolean;
    stripeAccountId: string | null;
    payoutsEnabled: boolean;
    sellerStatus: string | null;
    sellerState?: "not_started" | "onboarding" | "restricted" | "active" | "payouts_disabled";
  } | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [stripeStatus, setStripeStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");
  const [stripeMessage, setStripeMessage] = useState("");
  const [prefillName, setPrefillName] = useState("");
  const [prefillEmail, setPrefillEmail] = useState("");

  useEffect(() => {
    if (session?.user?.name) setPrefillName(session.user.name);
    if (session?.user?.email) setPrefillEmail(session.user.email);
  }, [session]);

  useEffect(() => {
    if (!session?.user?.id) {
      setConnect(null);
      return;
    }
    let cancelled = false;
    void fetch("/api/stripe/connect", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => {
        if (!cancelled) {
          setConnect(payload);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setConnect(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("loading");
    setMessage("");

    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = {
      displayName: formData.get("name"),
      phone: formData.get("phone"),
      businessName: formData.get("businessName"),
      inventorySummary: formData.get("inventorySummary"),
      streamExperience: formData.get("streamExperience"),
      socialHandle: formData.get("socialHandle"),
      website: formData.get("website"),
      notes: formData.get("notes"),
      agreeToTerms: formData.get("agreeToTerms") === "on",
    };

    try {
      const response = await fetch("/api/sellers/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Submission failed");
      }

      setStatus("success");
      setMessage("Application submitted. We review manually and only admin can approve sellers.");
      form.reset();
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unable to submit right now.");
    }
  };

  const handleConnectStripe = async () => {
    setStripeStatus("loading");
    setStripeMessage("");

    try {
      const response = await fetch("/api/stripe/connect", { method: "POST" });
      const payload = (await response.json()) as { url?: string; redirectPath?: string; error?: string };

      if (!response.ok || (!payload.redirectPath && !payload.url)) {
        throw new Error(payload.error || "Unable to start Stripe onboarding.");
      }

      const target = typeof payload.redirectPath === "string" && payload.redirectPath.trim()
        ? payload.redirectPath.trim()
        : payload.url!;
      window.location.assign(target);
    } catch (error) {
      setStripeStatus("error");
      setStripeMessage(error instanceof Error ? error.message : "Unable to connect Stripe right now.");
    }
  };

  return (
    <PageContainer className="seller-verification-page app-page--seller-verification">
      <section className="app-section">
        <FormContainer className="seller-verification-form">
          <PageHeader
            title="Seller verification"
            subtitle="Get verified to go live. Approval stays manual and the application stays tight."
            actions={
              session?.user?.id ? (
                <SecondaryButton onClick={handleConnectStripe} disabled={stripeStatus === "loading"}>
                  {stripeStatus === "loading" ? "Opening Stripe..." : "Connect Stripe payouts"}
                </SecondaryButton>
              ) : undefined
            }
          />

          <ol className="app-stepper seller-verification-stepper" aria-label="Seller verification steps">
            <li className={`app-step${session?.user?.id ? " is-done" : " is-active"}`}>
              <span>1</span>
              <strong>Account</strong>
            </li>
            <li className={`app-step${connect?.payoutsEnabled ? " is-done" : connect?.stripeAccountId ? " is-active" : ""}`}>
              <span>2</span>
              <strong>Payouts</strong>
            </li>
            <li className={`app-step${connect?.sellerState === "active" ? " is-done" : connect?.sellerState === "onboarding" ? " is-active" : ""}`}>
              <span>3</span>
              <strong>Review</strong>
            </li>
          </ol>

          {!session?.user?.id ? (
            <div className="trade-compose-signin">
              <p>Sign in with Google to start seller verification.</p>
              <PrimaryButton onClick={() => signIn()}>Sign in</PrimaryButton>
            </div>
          ) : (
            <div className="app-status-note is-success">
              Signed in as {session.user.email ?? "account"}.
            </div>
          )}

          {stripeMessage ? (
            <div className="app-status-note is-error">{stripeMessage}</div>
          ) : null}

          {connect?.sellerState === "active" ? (
            <div className="app-status-note is-success">
              Seller approval and Stripe payouts are active.
            </div>
          ) : null}
          {connect?.sellerState === "onboarding" ? (
            <div className="app-status-note is-warning">
              Seller verification is under review. You can complete Stripe onboarding now, but listing and live selling stay gated until approval.
            </div>
          ) : null}
          {connect?.sellerState === "payouts_disabled" ? (
            <div className="app-status-note is-warning">
              Seller verification is approved, but Stripe payouts still need to be completed before selling is enabled.
            </div>
          ) : null}
          {connect?.sellerState === "restricted" ? (
            <div className="app-status-note is-error">
              Seller access is restricted. Contact support before attempting to sell or reconnect payouts.
            </div>
          ) : null}

          <section className="product-card seller-verification-panel">
            <form className="app-form" onSubmit={handleSubmit}>
              <div className="app-form-grid app-form-grid--2">
                <label className="app-form-field">
                  <span>Business or seller name</span>
                  <input name="name" type="text" required placeholder="Business or seller name" defaultValue={prefillName} className="app-form-input" />
                </label>
                <label className="app-form-field">
                  <span>Registered business name</span>
                  <input name="businessName" type="text" required minLength={2} placeholder="Registered business name" className="app-form-input" />
                </label>
              </div>

              <div className="app-form-grid app-form-grid--2">
                <label className="app-form-field">
                  <span>Email</span>
                  <input name="email" type="email" disabled value={prefillEmail} className="app-form-input" />
                </label>
                <label className="app-form-field">
                  <span>Phone number</span>
                  <input name="phone" type="tel" required placeholder="Phone number" className="app-form-input" />
                </label>
              </div>

              <label className="app-form-field">
                <span>Inventory summary</span>
                <textarea name="inventorySummary" rows={4} required minLength={20} placeholder="Brands, categories, and quantity range" className="app-form-textarea" />
              </label>

              <label className="app-form-field">
                <span>Streaming setup and experience</span>
                <textarea name="streamExperience" rows={3} required minLength={10} placeholder="Streaming experience and setup details" className="app-form-textarea" />
              </label>

              <div className="app-form-grid app-form-grid--2">
                <label className="app-form-field">
                  <span>Instagram / TikTok</span>
                  <input name="socialHandle" type="text" placeholder="Instagram/TikTok handle" className="app-form-input" />
                </label>
                <label className="app-form-field">
                  <span>Website</span>
                  <input name="website" type="url" placeholder="Website (optional)" className="app-form-input" />
                </label>
              </div>

              <label className="app-form-field">
                <span>Notes</span>
                <textarea name="notes" rows={3} placeholder="Anything else reviewers should know" className="app-form-textarea" />
              </label>

              <label className="app-form-check">
                <input name="agreeToTerms" type="checkbox" required />
                <span>I confirm all information is accurate and understand seller approval is manual and can be rejected.</span>
              </label>

              <div className="app-form-actions">
                <PrimaryButton type="submit" disabled={status === "loading"}>
                  {status === "loading" ? "Submitting..." : "Submit verification"}
                </PrimaryButton>
              </div>
            </form>
          </section>

          {message ? (
            <div className={`app-status-note ${status === "success" ? "is-success" : "is-error"}`}>
              {message}
            </div>
          ) : null}
        </FormContainer>
      </section>
    </PageContainer>
  );
}
