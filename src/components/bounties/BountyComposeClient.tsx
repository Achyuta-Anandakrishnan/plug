"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { fetchClientApi, normalizeClientError } from "@/lib/client-api";
import {
  FormContainer,
  PageContainer,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
} from "@/components/product/ProductUI";

function toCents(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed * 100);
}

export function BountyComposeClient() {
  const router = useRouter();
  const { data: session } = useSession();

  const [lookingFor, setLookingFor] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [bountyAmount, setBountyAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const desiredMin = toCents(priceMin);
  const desiredMax = toCents(priceMax);
  const desiredBounty = toCents(bountyAmount);

  const submit = async () => {
    if (!session?.user?.id) {
      await signIn();
      return;
    }
    if (!lookingFor.trim()) {
      setError("Describe what you're looking for.");
      return;
    }
    if (desiredMin === null && desiredMax === null) {
      setError("Add a budget or price range.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const response = await fetchClientApi("/api/bounties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: lookingFor.trim(),
          itemName: lookingFor.trim(),
          priceMin: desiredMin,
          priceMax: desiredMax,
          bountyAmount: desiredBounty,
          notes: notes.trim() || null,
        }),
      });
      const payload = (await response.json()) as { id?: string; error?: string };
      if (!response.ok || !payload.id) throw new Error(payload.error || "Unable to post bounty.");
      router.push(`/bounties/${payload.id}`);
      router.refresh();
    } catch (err) {
      setError(normalizeClientError(err, "Unable to post bounty."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageContainer className="bounty-compose-page app-page--bounty-compose">
      <section className="app-section">
        <PageHeader
          eyebrow="Bounty board"
          title="Post a want"
          subtitle="Tell the community what you're looking for and what you'll pay."
          actions={<SecondaryButton href="/bounties">Back to board</SecondaryButton>}
        />

        <FormContainer>
          <section className="product-card bounty-compose-card">
            {error ? <p className="app-form-note is-error">{error}</p> : null}

            <div className="app-form bounty-compose-form">
              <label className="app-form-field">
                <span>Looking for</span>
                <input
                  value={lookingFor}
                  onChange={(e) => setLookingFor(e.target.value)}
                  className="app-form-input bounty-compose-main-input"
                  placeholder="e.g. PSA 10 1952 Topps Mickey Mantle, Shohei Ohtani RC auto"
                  autoFocus
                />
              </label>

              <div className="bounty-compose-price-row">
                <label className="app-form-field">
                  <span>Willing to pay — min ($)</span>
                  <input
                    value={priceMin}
                    onChange={(e) => setPriceMin(e.target.value)}
                    className="app-form-input"
                    inputMode="decimal"
                    placeholder="400"
                  />
                </label>
                <label className="app-form-field">
                  <span>Max ($)</span>
                  <input
                    value={priceMax}
                    onChange={(e) => setPriceMax(e.target.value)}
                    className="app-form-input"
                    inputMode="decimal"
                    placeholder="500"
                  />
                </label>
                <label className="app-form-field">
                  <span>Bounty / finders fee ($)</span>
                  <input
                    value={bountyAmount}
                    onChange={(e) => setBountyAmount(e.target.value)}
                    className="app-form-input"
                    inputMode="decimal"
                    placeholder="25"
                  />
                </label>
              </div>

              <label className="app-form-field">
                <span>Notes <span className="app-form-optional">(optional)</span></span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value.slice(0, 240))}
                  className="app-form-textarea"
                  placeholder="Centering, eye appeal, serial range, cert number, specific variant…"
                  rows={3}
                />
                <span className="app-form-count">{240 - notes.length} left</span>
              </label>

              <div className="bounty-compose-actions">
                <PrimaryButton onClick={() => void submit()} disabled={submitting}>
                  {submitting ? "Posting…" : "Post bounty"}
                </PrimaryButton>
              </div>
            </div>
          </section>
        </FormContainer>
      </section>
    </PageContainer>
  );
}
