"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AuthButtons } from "@/components/AuthButtons";
import { FormContainer, PageContainer, PageHeader } from "@/components/product/ProductUI";
import { useMobileUi } from "@/hooks/useMobileUi";

export default function SignupPage() {
  const isMobileUi = useMobileUi();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("Buyer");
  const [category, setCategory] = useState("Pokemon");
  const [referral, setReferral] = useState("");

  useEffect(() => {
    const ref = (searchParams.get("ref") ?? "").trim();
    if (ref) setReferral(ref);
  }, [searchParams]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("loading");
    setMessage("");

    const displayName = `${firstName} ${lastName}`.trim();
    const payload = {
      email,
      phone,
      displayName: displayName || undefined,
      role: role.toUpperCase() as "BUYER" | "SELLER" | "BOTH",
      applyAsSeller: role !== "Buyer",
      category,
      referral,
    };

    try {
      const response = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Unable to create account.");
      }
      setStatus("success");
      setMessage("Account created. Check your inbox for a verification link, then finish profile setup after sign-in.");
      setFirstName("");
      setLastName("");
      setEmail("");
      setPhone("");
      setRole("Buyer");
      setCategory("Pokemon");
      setReferral("");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unable to create account.");
    }
  };

  if (isMobileUi) {
    return (
      <PageContainer className="auth-page app-page--auth auth-mobile-page">
        <section className="app-section auth-mobile-screen auth-mobile-screen-signup">
          <div className="auth-mobile-hero">
            <p className="app-eyebrow">dalow</p>
            <h1 className="auth-mobile-title">Create account</h1>
            <p className="auth-mobile-copy">Join the marketplace, live rooms, and collector workflow in one place.</p>
          </div>

          <section className="product-card auth-panel auth-panel-mobile auth-panel-signup">
            <div className="auth-oauth-block">
              <AuthButtons />
            </div>

            <div className="auth-divider">
              <span />
              <strong>Or continue with email</strong>
              <span />
            </div>

            <form className="app-form" onSubmit={handleSubmit}>
              <div className="app-form-grid app-form-grid--2">
                <label className="app-form-field">
                  <span>First name</span>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    className="app-form-input"
                    placeholder="First name"
                  />
                </label>
                <label className="app-form-field">
                  <span>Last name</span>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    className="app-form-input"
                    placeholder="Last name"
                  />
                </label>
              </div>

              <label className="app-form-field">
                <span>Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="app-form-input"
                  placeholder="Email address"
                  required
                />
              </label>

              <label className="app-form-field">
                <span>Mobile number</span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  className="app-form-input"
                  placeholder="Mobile number"
                />
              </label>

              <div className="app-form-grid app-form-grid--2">
                <label className="app-form-field">
                  <span>Account type</span>
                  <select
                    value={role}
                    onChange={(event) => setRole(event.target.value)}
                    className="app-form-input"
                  >
                    <option>Buyer</option>
                    <option>Seller</option>
                    <option>Both</option>
                  </select>
                </label>
                <label className="app-form-field">
                  <span>Primary category</span>
                  <select
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                    className="app-form-input"
                  >
                    <option>Pokemon</option>
                    <option>Sports</option>
                    <option>Anime</option>
                    <option>Funko</option>
                    <option>Collectibles</option>
                  </select>
                </label>
              </div>

              <label className="app-form-field">
                <span>Referral code</span>
                <input
                  type="text"
                  value={referral}
                  onChange={(event) => setReferral(event.target.value)}
                  className="app-form-input"
                  placeholder="Optional referral code"
                />
              </label>

              <label className="app-form-check">
                <input type="checkbox" />
                <span>I agree to the buyer protection policy and terms of service.</span>
              </label>

              <div className="app-form-actions">
                <button
                  className="app-button app-button-primary"
                  disabled={status === "loading"}
                >
                  {status === "loading" ? "Creating..." : "Create account"}
                </button>
              </div>
            </form>
          </section>

          {message ? (
            <div className={`auth-status-note ${status === "success" ? "is-success" : "is-error"}`}>
              {message}
            </div>
          ) : null}

          <div className="auth-support-note auth-support-note-mobile">
            Already have an account?{" "}
            <Link href="/signin">
              Sign in
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
            title="Create account"
            subtitle="Join the marketplace, live rooms, and collector workflow in one place."
            className="auth-page-header"
          />

          <section className="product-card auth-panel auth-panel-signup">
            <div className="auth-oauth-block">
              <AuthButtons />
            </div>

            <div className="auth-divider">
              <span />
              <strong>Or continue with email</strong>
              <span />
            </div>

            <form className="app-form" onSubmit={handleSubmit}>
              <div className="app-form-grid app-form-grid--2">
                <label className="app-form-field">
                  <span>First name</span>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    className="app-form-input"
                    placeholder="First name"
                  />
                </label>
                <label className="app-form-field">
                  <span>Last name</span>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    className="app-form-input"
                    placeholder="Last name"
                  />
                </label>
              </div>

              <label className="app-form-field">
                <span>Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="app-form-input"
                  placeholder="Email address"
                  required
                />
              </label>

              <label className="app-form-field">
                <span>Mobile number</span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  className="app-form-input"
                  placeholder="Mobile number"
                />
              </label>

              <div className="app-form-grid app-form-grid--2">
                <label className="app-form-field">
                  <span>Account type</span>
                  <select
                    value={role}
                    onChange={(event) => setRole(event.target.value)}
                    className="app-form-input"
                  >
                    <option>Buyer</option>
                    <option>Seller</option>
                    <option>Both</option>
                  </select>
                </label>
                <label className="app-form-field">
                  <span>Primary category</span>
                  <select
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                    className="app-form-input"
                  >
                    <option>Pokemon</option>
                    <option>Sports</option>
                    <option>Anime</option>
                    <option>Funko</option>
                    <option>Collectibles</option>
                  </select>
                </label>
              </div>

              <label className="app-form-field">
                <span>Referral code</span>
                <input
                  type="text"
                  value={referral}
                  onChange={(event) => setReferral(event.target.value)}
                  className="app-form-input"
                  placeholder="Optional referral code"
                />
              </label>

              <label className="app-form-check">
                <input type="checkbox" />
                <span>I agree to the buyer protection policy and terms of service.</span>
              </label>

              <div className="app-form-actions">
                <button
                  className="app-button app-button-primary"
                  disabled={status === "loading"}
                >
                  {status === "loading" ? "Creating..." : "Create account"}
                </button>
              </div>
            </form>
          </section>

          {message ? (
            <div className={`auth-status-note ${status === "success" ? "is-success" : "is-error"}`}>
              {message}
            </div>
          ) : null}

          <div className="auth-support-note">
            Already have an account?{" "}
            <Link href="/signin">
              Sign in
            </Link>
          </div>
        </FormContainer>
      </section>
    </PageContainer>
  );
}
