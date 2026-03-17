import Link from "next/link";
import { consumeEmailVerificationToken } from "@/lib/email-verification";
import { FormContainer, PageContainer, PageHeader, PrimaryButton, SecondaryButton } from "@/components/product/ProductUI";

type VerifyEmailPageProps = {
  searchParams?: Promise<{
    token?: string;
  }>;
};

export default async function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  const resolved = searchParams ? await searchParams : {};
  const token = resolved.token?.trim() ?? "";
  const result = token
    ? await consumeEmailVerificationToken(token)
    : { ok: false as const, error: "Missing verification token." };

  return (
    <PageContainer className="auth-page app-page--auth">
      <section className="app-section">
        <FormContainer className="auth-form-layout">
          <PageHeader
            title={result.ok ? "Email verified" : "Verification failed"}
            subtitle={
              result.ok
                ? `Your email${result.email ? ` (${result.email})` : ""} is now verified.`
                : result.error
            }
          />

          <section className="product-card auth-panel">
            <div className="app-form-actions">
              <PrimaryButton href="/settings">Open settings</PrimaryButton>
              <SecondaryButton href="/signin">Go to sign in</SecondaryButton>
            </div>
            {!result.ok ? (
              <p className="auth-support-note">
                Need a new link? Open{" "}
                <Link href="/settings">
                  Settings
                </Link>{" "}
                after signing in.
              </p>
            ) : null}
          </section>
        </FormContainer>
      </section>
    </PageContainer>
  );
}
