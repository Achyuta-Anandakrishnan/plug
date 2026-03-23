"use client";

import Link from "next/link";
import { AuthButtons } from "@/components/AuthButtons";
import { FormContainer, PageContainer, PageHeader } from "@/components/product/ProductUI";
import { useMobileUi } from "@/hooks/useMobileUi";

export default function SignInPage() {
  const isMobileUi = useMobileUi();

  if (isMobileUi) {
    return (
      <PageContainer className="auth-page app-page--auth auth-mobile-page">
        <section className="app-section auth-mobile-screen">
          <div className="auth-mobile-hero">
            <p className="app-eyebrow">dalow</p>
            <h1 className="auth-mobile-title">Sign in</h1>
            <p className="auth-mobile-copy">Streams, listings, trades, and messages in one account.</p>
          </div>

          <section className="product-card auth-panel auth-panel-mobile">
            <AuthButtons />
          </section>

          <div className="auth-support-note auth-support-note-mobile">
            New here?{" "}
            <Link href="/signup">
              Create an account
            </Link>
          </div>
        </section>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="auth-page app-page--auth">
      <section className="app-section">
        <FormContainer className="auth-form-layout">
          <PageHeader
            eyebrow="dalow"
            title="Sign in"
            subtitle="Streams, listings, trades, and messages in one account."
            className="auth-page-header"
          />

          <section className="product-card auth-panel">
            <AuthButtons />
          </section>

          <div className="auth-support-note">
            New here?{" "}
            <Link href="/signup">
              Create an account
            </Link>
          </div>
        </FormContainer>
      </section>
    </PageContainer>
  );
}
