"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { signIn, useSession } from "next-auth/react";
import { useCategories } from "@/hooks/useCategories";
import {
  nextThursdayNinePmEst,
  toDateTimeLocalInputValue,
} from "@/lib/auction-time";
import { formatCurrency } from "@/lib/format";
import {
  GRADING_COMPANIES,
  getGradeOptions,
  getGradingProfile,
} from "@/lib/grading";

const steps = ["Basics", "Pricing", "Media", "Preview"] as const;

function toCents(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed * 100);
}

export function SellerListingMobile() {
  const { data: categories } = useCategories();
  const { data: session } = useSession();
  const isSeller =
    session?.user?.role === "SELLER" || session?.user?.role === "ADMIN";
  const sessionSellerId = isSeller ? session?.user?.id ?? "" : "";
  const [stepIndex, setStepIndex] = useState(0);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");
  const [uploadMessage, setUploadMessage] = useState("");
  const [listingId, setListingId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [condition, setCondition] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [listingType, setListingType] = useState<
    "AUCTION" | "BUY_NOW" | "BOTH"
  >("AUCTION");
  const [startingBid, setStartingBid] = useState("100");
  const [buyNowPrice, setBuyNowPrice] = useState("250");
  const [minBidIncrement, setMinBidIncrement] = useState("20");
  const [endTime, setEndTime] = useState(
    () => toDateTimeLocalInputValue(nextThursdayNinePmEst()),
  );
  const [publishNow, setPublishNow] = useState(false);
  const [isGraded, setIsGraded] = useState<"YES" | "NO">("NO");
  const [gradingCompany, setGradingCompany] = useState("PSA");
  const [grade, setGrade] = useState("");
  const [gradingLabel, setGradingLabel] = useState("");
  const [certNumber, setCertNumber] = useState("");
  const [lookupMessage, setLookupMessage] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const lastLookupKeyRef = useRef("");
  const [images, setImages] = useState<
    Array<{
      url: string;
      storageProvider: "SUPABASE";
      storagePath?: string;
      bytes?: number;
      previewUrl?: string;
    }>
  >([]);

  const listingPreview = useMemo(() => {
    const bid = toCents(startingBid) ?? 0;
    return formatCurrency(bid, "USD");
  }, [startingBid]);
  const selectedCategorySlug = useMemo(
    () => categories.find((entry) => entry.id === categoryId)?.slug ?? null,
    [categories, categoryId],
  );
  const gradingProfile = useMemo(
    () => getGradingProfile(gradingCompany),
    [gradingCompany],
  );
  const gradeOptions = useMemo(
    () => getGradeOptions(gradingCompany),
    [gradingCompany],
  );
  const needsAuctionPricing = listingType !== "BUY_NOW";
  const needsBuyNowPricing = listingType !== "AUCTION";

  const handleImageChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    setUploadMessage("Uploading images...");
    try {
      const uploaded = await Promise.all(
        files.map(async (file) => {
          const formData = new FormData();
          formData.append("file", file);
          const response = await fetch("/api/uploads", {
            method: "POST",
            body: formData,
          });
          const payload = await response.json();
          if (!response.ok) {
            throw new Error(payload.error || "Image upload failed.");
          }
          return {
            url: payload.url as string,
            storageProvider: "SUPABASE" as const,
            storagePath: payload.storagePath as string | undefined,
            bytes: payload.bytes as number | undefined,
            previewUrl: URL.createObjectURL(file),
          };
        }),
      );
      setImages((prev) => [...prev, ...uploaded]);
      setUploadMessage("Upload complete.");
    } catch (error) {
      setUploadMessage(
        error instanceof Error ? error.message : "Unable to upload images.",
      );
    } finally {
      event.target.value = "";
    }
  };

  const handleSubmit = async () => {
    setStatus("loading");
    setMessage("");

    const payload = {
      listingType,
      title,
      description,
      startingBid: needsAuctionPricing ? toCents(startingBid) : undefined,
      buyNowPrice: needsBuyNowPricing ? toCents(buyNowPrice) : undefined,
      minBidIncrement:
        needsAuctionPricing && minBidIncrement
          ? toCents(minBidIncrement)
          : undefined,
      endTime: endTime ? new Date(endTime).toISOString() : undefined,
      publishNow,
      currency: "usd",
      categoryId: categoryId || undefined,
      item: {
        title,
        description,
        condition,
        categoryId: categoryId || undefined,
        attributes: {
          categorySlug: selectedCategorySlug,
          isGraded: isGraded === "YES",
          gradingCompany: isGraded === "YES" ? gradingCompany : null,
          gradingLabel: isGraded === "YES" ? gradingLabel || null : null,
          grade: isGraded === "YES" ? grade || null : null,
          certNumber: isGraded === "YES" ? certNumber.trim() || null : null,
          listingMode: listingType,
        },
      },
      images: images.map((image, index) => ({
        url: image.url,
        isPrimary: index === 0,
        storageProvider: image.storageProvider,
        storagePath: image.storagePath,
        bytes: image.bytes,
      })),
    };

    try {
      const response = await fetch("/api/auctions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Unable to create listing.");
      }
      setListingId(data.id);
      setStatus("success");
      setMessage("Listing created.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unable to create listing.");
    }
  };

  useEffect(() => {
    if (isGraded !== "YES" || certNumber.trim().length < 4) {
      setLookupLoading(false);
      setLookupMessage("");
      lastLookupKeyRef.current = "";
      return;
    }

    const lookupKey = `${gradingCompany}:${certNumber.trim()}`;
    if (lastLookupKeyRef.current === lookupKey) {
      return;
    }

    lastLookupKeyRef.current = lookupKey;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLookupLoading(true);
      try {
        const response = await fetch(
          `/api/grading/lookup?company=${encodeURIComponent(gradingCompany)}&cert=${encodeURIComponent(certNumber.trim())}`,
        );
        const payload = (await response.json()) as {
          found?: boolean;
          grade?: string | null;
          label?: string | null;
          note?: string;
          error?: string;
        };

        if (cancelled) return;
        if (!response.ok) {
          setLookupMessage(payload.error || "Unable to verify cert right now.");
          return;
        }
        if (payload.found) {
          if (payload.grade && !grade) setGrade(payload.grade);
          if (payload.label && !gradingLabel) setGradingLabel(payload.label);
          setLookupMessage(payload.note || "Certificate found.");
        } else {
          setLookupMessage(payload.note || "No certificate match found.");
        }
      } catch {
        if (!cancelled) setLookupMessage("Unable to verify cert right now.");
      } finally {
        if (!cancelled) setLookupLoading(false);
      }
    }, 500);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [certNumber, gradingCompany, gradingLabel, grade, isGraded]);

  return (
    <div className="sell-mobile-screen">
      <section className="sell-mobile-header">
        <h2 className="sell-mobile-title">Create a listing</h2>
        <p className="sell-step-hint">
          Step {stepIndex + 1} of {steps.length}: {steps[stepIndex]}
        </p>
      </section>

      <div className="sell-progress-card">
        <div className="sell-step-track">
          {steps.map((step, index) => (
            <span key={step} className={index === stepIndex ? "is-active" : ""}>
              {step}
            </span>
          ))}
        </div>
        <div className="sell-progress-bar">
          <div
            className="sell-progress-fill"
            style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>

      {stepIndex === 0 ? (
        <section className="sell-form-panel">
          {sessionSellerId ? (
            <p className="app-status-note is-success">
              Signed in as {session?.user?.email ?? "seller"}.
            </p>
          ) : (
            <div className="sell-alert-stack">
              {session?.user?.id ? (
                <p className="app-status-note is-warning">
                  Your account is not a seller yet. Submit seller verification for manual review.
                </p>
              ) : null}
              {!session?.user?.id ? (
                <button
                  onClick={() => void signIn()}
                  className="app-button app-button-primary"
                >
                  Sign in
                </button>
              ) : null}
            </div>
          )}

          <div className="app-form-field">
            <label className="app-form-label">Category</label>
            <select
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              className="app-form-input"
            >
              <option value="">Primary category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div className="app-form-field">
            <label className="app-form-label">Title</label>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Listing title"
              className="app-form-input"
              required
            />
          </div>

          <div className="app-form-field">
            <label className="app-form-label">Description</label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Description"
              rows={4}
              className="app-form-textarea"
            />
          </div>

          <div className="app-form-field">
            <label className="app-form-label">Condition notes</label>
            <input
              value={condition}
              onChange={(event) => setCondition(event.target.value)}
              placeholder="Condition notes"
              className="app-form-input"
            />
          </div>

          <div className="sell-grading-block">
            <p className="app-form-label">Grading</p>

            <div className="app-form-field">
              <label className="app-form-label">Is graded?</label>
              <select
                value={isGraded}
                onChange={(event) => setIsGraded(event.target.value as "YES" | "NO")}
                className="app-form-input"
              >
                <option value="NO">No</option>
                <option value="YES">Yes</option>
              </select>
            </div>

            {isGraded === "YES" ? (
              <>
                <div className="app-form-field">
                  <label className="app-form-label">Grading company</label>
                  <select
                    value={gradingCompany}
                    onChange={(event) => {
                      setGradingCompany(event.target.value);
                      setGrade("");
                      setGradingLabel("");
                    }}
                    className="app-form-input"
                  >
                    {GRADING_COMPANIES.map((company) => (
                      <option key={company} value={company}>
                        {company}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="app-form-field">
                  <label className="app-form-label">Grade</label>
                  <select
                    value={grade}
                    onChange={(event) => setGrade(event.target.value)}
                    className="app-form-input"
                  >
                    <option value="">Select grade</option>
                    {gradeOptions.map((entry) => (
                      <option key={entry} value={entry}>
                        {entry}
                      </option>
                    ))}
                  </select>
                </div>

                {gradingProfile.labelOptions.length > 0 ? (
                  <div className="app-form-field">
                    <label className="app-form-label">Label tier</label>
                    <select
                      value={gradingLabel}
                      onChange={(event) => setGradingLabel(event.target.value)}
                      className="app-form-input"
                    >
                      <option value="">Standard label</option>
                      {gradingProfile.labelOptions.map((label) => (
                        <option key={label} value={label}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}

                <p className="sell-hint">{gradingProfile.note}</p>

                <div className="app-form-field">
                  <label className="app-form-label">Cert number</label>
                  <input
                    value={certNumber}
                    onChange={(event) => setCertNumber(event.target.value)}
                    placeholder="Certification #"
                    className="app-form-input"
                  />
                  {lookupMessage ? (
                    <p className="sell-hint">
                      {lookupLoading ? "Checking cert..." : lookupMessage}
                    </p>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>
        </section>
      ) : null}

      {stepIndex === 1 ? (
        <section className="sell-form-panel">
          <div className="sell-type-grid">
            {(["AUCTION", "BUY_NOW", "BOTH"] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setListingType(type)}
                className={`sell-type-btn${listingType === type ? " is-active" : ""}`}
              >
                {type === "BOTH" ? "Buy Now + Auction" : type.replace("_", " ")}
              </button>
            ))}
          </div>

          {needsAuctionPricing ? (
            <div className="app-form-field">
              <label className="app-form-label">Starting bid (USD)</label>
              <input
                value={startingBid}
                onChange={(event) => setStartingBid(event.target.value)}
                placeholder="Starting bid"
                className="app-form-input"
              />
            </div>
          ) : null}

          {needsBuyNowPricing ? (
            <div className="app-form-field">
              <label className="app-form-label">Buy now price (USD)</label>
              <input
                value={buyNowPrice}
                onChange={(event) => setBuyNowPrice(event.target.value)}
                placeholder="Buy now price"
                className="app-form-input"
              />
            </div>
          ) : null}

          {needsAuctionPricing ? (
            <div className="app-form-field">
              <label className="app-form-label">Min bid increment (USD)</label>
              <input
                value={minBidIncrement}
                onChange={(event) => setMinBidIncrement(event.target.value)}
                placeholder="Min bid increment"
                className="app-form-input"
              />
            </div>
          ) : null}

          <div className="app-form-field">
            <label className="app-form-label">End time</label>
            <input
              type="datetime-local"
              value={endTime}
              onChange={(event) => setEndTime(event.target.value)}
              className="app-form-input"
            />
            <p className="sell-hint">Default: Thursday 9:00 PM EST.</p>
          </div>

          <label className="sell-checkbox-row">
            <input
              type="checkbox"
              checked={publishNow}
              onChange={(event) => setPublishNow(event.target.checked)}
            />
            <span>Publish immediately</span>
          </label>

          <div className="sell-preview-note">
            Preview starting bid: {listingPreview}
          </div>
        </section>
      ) : null}

      {stepIndex === 2 ? (
        <section className="sell-form-panel">
          <div className="app-form-field">
            <label className="app-form-label">Photos</label>
            <div className="sell-upload-grid">
              <input
                type="file"
                multiple
                accept="image/*"
                capture="environment"
                onChange={handleImageChange}
                className="sell-file-input"
              />
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleImageChange}
                className="sell-file-input"
              />
            </div>
            <p className="sell-hint">Top: take photo. Bottom: upload from device.</p>

            {uploadMessage ? (
              <p className="app-status-note">{uploadMessage}</p>
            ) : null}

            {images.length > 0 ? (
              <div className="sell-image-preview-grid">
                {images.map((image) => (
                  <div key={image.url} className="sell-image-preview-item">
                    <div className="sell-image-preview-inner">
                      <Image
                        src={image.previewUrl ?? image.url}
                        alt="Upload preview"
                        fill
                        sizes="160px"
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {stepIndex === 3 ? (
        <section className="sell-form-panel">
          <div className="sell-review-rows">
            <div className="sell-review-row">
              <p className="app-eyebrow">Title</p>
              <p className="sell-review-value">{title || "Untitled listing"}</p>
            </div>
            <div className="sell-review-row">
              <p className="app-eyebrow">Type</p>
              <p className="sell-review-value">
                {listingType === "BOTH" ? "Buy Now + Auction" : listingType.replace("_", " ")}
              </p>
            </div>
            <div className="sell-review-row">
              <p className="app-eyebrow">Pricing</p>
              <p className="sell-review-value">
                {needsAuctionPricing ? `Start ${formatCurrency(toCents(startingBid) ?? 0, "USD")}` : "No bidding"}
                {needsBuyNowPricing ? ` · Buy now ${formatCurrency(toCents(buyNowPrice) ?? 0, "USD")}` : ""}
              </p>
            </div>
          </div>

          {description ? (
            <p className="sell-review-description">{description}</p>
          ) : null}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={status === "loading"}
            className="app-button app-button-primary sell-submit-btn"
          >
            {status === "loading" ? "Creating..." : "Post listing"}
          </button>

          {message ? (
            <p className={`app-status-note${status === "success" ? " is-success" : " is-error"}`}>
              {message}
            </p>
          ) : null}

          {listingId ? (
            <p className="app-status-note is-success">
              Listing created.{" "}
              <Link href={`/streams/${listingId}`} className="app-link">
                Open listing
              </Link>
            </p>
          ) : null}
        </section>
      ) : null}

      <div className="sell-nav-row">
        <button
          type="button"
          onClick={() => setStepIndex((prev) => Math.max(0, prev - 1))}
          className="app-button app-button-secondary"
          disabled={stepIndex === 0}
        >
          Back
        </button>
        <button
          type="button"
          onClick={() => setStepIndex((prev) => Math.min(steps.length - 1, prev + 1))}
          className="app-button app-button-primary"
          disabled={stepIndex === steps.length - 1}
        >
          Next
        </button>
      </div>
    </div>
  );
}
