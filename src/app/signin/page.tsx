"use client";

import Link from "next/link";
import { AuthButtons } from "@/components/AuthButtons";
import { FormContainer, PageContainer, PageHeader } from "@/components/product/ProductUI";

export default function SignInPage() {
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
