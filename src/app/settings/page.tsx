"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import {
  DiscoveryBar,
  FormContainer,
  PageContainer,
  PrimaryButton,
  SecondaryButton,
} from "@/components/product/ProductUI";
import { ProfileEditor } from "@/components/settings/ProfileEditor";

export default function SettingsPage() {
  const { data: session } = useSession();

  return (
    <PageContainer className="settings-page app-page--settings">
      <section className="app-section">
        <DiscoveryBar className="app-control-bar settings-toolbar">
          <div className="app-control-title">Settings</div>
          <div className="app-toolbar-spacer" aria-hidden="true" />
          {session?.user?.id ? (
            <SecondaryButton onClick={() => void signOut()}>Sign out</SecondaryButton>
          ) : (
            <PrimaryButton onClick={() => void signIn()}>Sign in</PrimaryButton>
          )}
          <SecondaryButton href="/referral">Referral program</SecondaryButton>
        </DiscoveryBar>

        <FormContainer>
          <section className="product-card settings-panel">
            <ProfileEditor />
          </section>
        </FormContainer>
      </section>
    </PageContainer>
  );
}
