"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import {
  FormContainer,
  PageContainer,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
} from "@/components/product/ProductUI";
import { ProfileEditor } from "@/components/settings/ProfileEditor";

export default function SettingsPage() {
  const { data: session } = useSession();

  return (
    <PageContainer className="settings-page app-page--settings">
      <section className="app-section settings-screen">
        <PageHeader
          title="Settings"
          subtitle="Profile, orders, referrals, and account controls in one place."
          actions={(
            <div className="settings-header-actions">
              <SecondaryButton href="/orders">Orders</SecondaryButton>
              <SecondaryButton href="/referral">Referral program</SecondaryButton>
              {session?.user?.id ? (
                <SecondaryButton onClick={() => void signOut()}>Sign out</SecondaryButton>
              ) : (
                <PrimaryButton onClick={() => void signIn()}>Sign in</PrimaryButton>
              )}
            </div>
          )}
        />

        <div className="settings-quick-links" aria-label="Settings shortcuts">
          <SecondaryButton href="/orders">Orders</SecondaryButton>
          <SecondaryButton href="/referral">Referral program</SecondaryButton>
          {session?.user?.id ? (
            <SecondaryButton onClick={() => void signOut()}>Sign out</SecondaryButton>
          ) : (
            <PrimaryButton onClick={() => void signIn()}>Sign in</PrimaryButton>
          )}
        </div>

        <FormContainer className="settings-form-column">
          <section className="product-card settings-panel">
            <ProfileEditor />
          </section>
        </FormContainer>
      </section>
    </PageContainer>
  );
}
