"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import {
  AppPageBar,
  PageContainer,
  PrimaryButton,
  SecondaryButton,
} from "@/components/product/ProductUI";
import { ProfileEditor } from "@/components/settings/ProfileEditor";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useMobileUi } from "@/hooks/useMobileUi";

export default function SettingsPage() {
  const isMobileUi = useMobileUi();
  const { data: session } = useSession();

  if (isMobileUi) {
    return (
      <PageContainer className="settings-page app-page--settings settings-mobile-page">
        <section className="app-section settings-mobile-screen">
          <section className="settings-mobile-subheader">
            <div className="app-control-title">Settings</div>
            <p className="settings-mobile-note">Profile, orders, referrals, and account controls.</p>
          </section>

          <section className="settings-mobile-actions-list" aria-label="Settings shortcuts">
            <SecondaryButton href="/orders">Orders</SecondaryButton>
            <SecondaryButton href="/settings/payments">Payments</SecondaryButton>
            <SecondaryButton href="/referral">Referral program</SecondaryButton>
            <ThemeToggle />
            {session?.user?.id ? (
              <SecondaryButton onClick={() => void signOut()}>Sign out</SecondaryButton>
            ) : (
              <PrimaryButton onClick={() => void signIn()}>Sign in</PrimaryButton>
            )}
          </section>

          <section className="settings-mobile-panel">
            <ProfileEditor />
          </section>
        </section>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="settings-page app-page--settings">
      <section className="app-section settings-screen">
        <AppPageBar title="Settings" />

        <div className="settings-sections">
          <section className="settings-section">
            <h2 className="settings-section-label">Profile</h2>
            <section className="product-card settings-panel">
              <ProfileEditor />
            </section>
          </section>

          <section className="settings-section">
            <h2 className="settings-section-label">Account</h2>
            <div className="product-card settings-links-panel">
              <SecondaryButton href="/orders">Orders</SecondaryButton>
              <SecondaryButton href="/settings/payments">Payments</SecondaryButton>
              <SecondaryButton href="/referral">Referral program</SecondaryButton>
              {session?.user?.id ? (
                <SecondaryButton onClick={() => void signOut()}>Sign out</SecondaryButton>
              ) : (
                <PrimaryButton onClick={() => void signIn()}>Sign in</PrimaryButton>
              )}
            </div>
          </section>

          <section className="settings-section">
            <h2 className="settings-section-label">Preferences</h2>
            <div className="product-card settings-prefs-panel">
              <ThemeToggle />
            </div>
          </section>
        </div>
      </section>
    </PageContainer>
  );
}
