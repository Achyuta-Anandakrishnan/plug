"use client";

import { useEffect, useMemo, useState } from "react";
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

const steps = ["Basics", "Pricing", "Media"] as const;

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
  const [listingType, setListingType] = useState("AUCTION");
  const [startingBid, setStartingBid] = useState("100");
  const [buyNowPrice, setBuyNowPrice] = useState("250");
  const [minBidIncrement, setMinBidIncrement] = useState("20");
  const [endTime, setEndTime] = useState(
    () => toDateTimeLocalInputValue(nextThursdayNinePmEst()),
  );
  const [publishNow, setPublishNow] = useState(true);
  const [isGraded, setIsGraded] = useState<"YES" | "NO">("NO");
  const [gradingCompany, setGradingCompany] = useState("PSA");
  const [grade, setGrade] = useState("");
  const [gradingLabel, setGradingLabel] = useState("");
  const [certNumber, setCertNumber] = useState("");
  const [lookupMessage, setLookupMessage] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
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
  const inputClass =
    "w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-700 outline-none focus:border-[var(--royal)]";
  const labelClass = "text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400";



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
      startingBid: listingType !== "BUY_NOW" ? toCents(startingBid) : undefined,
      buyNowPrice: listingType !== "AUCTION" ? toCents(buyNowPrice) : undefined,
      minBidIncrement:
        listingType !== "BUY_NOW" && minBidIncrement
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
      return;
    }

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
    <div className="space-y-6">
      <section className="space-y-3">
        <h1 className="font-display text-3xl text-slate-900">
          Create a listing
        </h1>
        <p className="text-sm text-slate-600">
          Step {stepIndex + 1} of {steps.length}: {steps[stepIndex]}
        </p>
      </section>

      <div className="surface-panel rounded-3xl p-4">
        <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-slate-400">
          {steps.map((step, index) => (
            <span key={step} className={index === stepIndex ? "text-slate-600" : ""}>
              {step}
            </span>
          ))}
        </div>
        <div className="mt-3 h-1.5 rounded-full bg-slate-200/70">
          <div
            className="h-full rounded-full bg-[var(--royal)] transition-all"
            style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>

      {stepIndex === 0 && (
        <section className="surface-panel rounded-3xl p-4 space-y-4">
          {sessionSellerId ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-700">
              Signed in as {session?.user?.email ?? "seller"}.
            </div>
          ) : (
            <div className="grid gap-2">
              {session?.user?.id && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
                  Your account is not a seller yet. Submit seller verification for manual review.
                </div>
              )}
              {!session?.user?.id && (
                <button
                  onClick={() => signIn()}
                  className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
                >
                  Sign in
                </button>
              )}
            </div>
          )}
          <div className="space-y-2">
            <p className={labelClass}>Category</p>
            <select
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              className={inputClass}
            >
              <option value="">Primary category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <p className={labelClass}>Title</p>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Listing title"
              className={inputClass}
              required
            />
          </div>
          <div className="space-y-2">
            <p className={labelClass}>Description</p>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Description"
              rows={4}
              className={inputClass}
            />
          </div>
          <div className="space-y-2">
            <p className={labelClass}>Condition notes</p>
            <input
              value={condition}
              onChange={(event) => setCondition(event.target.value)}
              placeholder="Condition notes"
              className={inputClass}
            />
          </div>
          <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white/80 p-3">
            <p className={labelClass}>Grading</p>
            <div className="space-y-2">
              <p className={labelClass}>Is graded?</p>
              <select
                value={isGraded}
                onChange={(event) => setIsGraded(event.target.value as "YES" | "NO")}
                className={inputClass}
              >
                <option value="NO">No</option>
                <option value="YES">Yes</option>
              </select>
            </div>
            {isGraded === "YES" && (
              <>
                <div className="space-y-2">
                  <p className={labelClass}>Grading company</p>
                  <select
                    value={gradingCompany}
                    onChange={(event) => {
                      setGradingCompany(event.target.value);
                      setGrade("");
                      setGradingLabel("");
                    }}
                    className={inputClass}
                  >
                    {GRADING_COMPANIES.map((company) => (
                      <option key={company} value={company}>
                        {company}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <p className={labelClass}>Grade</p>
                  <select
                    value={grade}
                    onChange={(event) => setGrade(event.target.value)}
                    className={inputClass}
                  >
                    <option value="">Select grade</option>
                    {gradeOptions.map((entry) => (
                      <option key={entry} value={entry}>
                        {entry}
                      </option>
                    ))}
                  </select>
                </div>
                {gradingProfile.labelOptions.length > 0 && (
                  <div className="space-y-2">
                    <p className={labelClass}>Label tier</p>
                    <select
                      value={gradingLabel}
                      onChange={(event) => setGradingLabel(event.target.value)}
                      className={inputClass}
                    >
                      <option value="">Standard label</option>
                      {gradingProfile.labelOptions.map((label) => (
                        <option key={label} value={label}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <p className="text-xs text-slate-500">{gradingProfile.note}</p>
                <div className="space-y-2">
                  <p className={labelClass}>Cert number</p>
                  <input
                    value={certNumber}
                    onChange={(event) => setCertNumber(event.target.value)}
                    placeholder="Certification #"
                    className={inputClass}
                  />
                  {lookupMessage && (
                    <p className="text-xs text-slate-500">
                      {lookupLoading ? "Checking cert..." : lookupMessage}
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </section>
      )}

      {stepIndex === 1 && (
        <section className="surface-panel rounded-3xl p-4 space-y-4">
          <div className="grid gap-2">
            {["AUCTION", "BUY_NOW", "BOTH"].map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setListingType(type)}
                className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold ${
                  listingType === type
                    ? "border-[var(--royal)] bg-blue-50 text-[var(--royal)]"
                    : "border-slate-200 text-slate-600"
                }`}
              >
                {type.replace("_", " ")}
              </button>
            ))}
          </div>
          {listingType !== "BUY_NOW" && (
            <input
              value={startingBid}
              onChange={(event) => setStartingBid(event.target.value)}
              placeholder="Starting bid (USD)"
              className={inputClass}
            />
          )}
          {listingType !== "AUCTION" && (
            <input
              value={buyNowPrice}
              onChange={(event) => setBuyNowPrice(event.target.value)}
              placeholder="Buy now price (USD)"
              className={inputClass}
            />
          )}
          {listingType !== "BUY_NOW" && (
            <input
              value={minBidIncrement}
              onChange={(event) => setMinBidIncrement(event.target.value)}
              placeholder="Min bid increment (USD)"
              className={inputClass}
            />
          )}
          <input
            type="datetime-local"
            value={endTime}
            onChange={(event) => setEndTime(event.target.value)}
            className={inputClass}
          />
          <p className="text-[11px] text-slate-500">
            Default auction end: Thursday 9:00 PM EST. Live streams can set custom duration.
          </p>
          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={publishNow}
              onChange={(event) => setPublishNow(event.target.checked)}
            />
            Publish immediately
          </label>
          <div className="rounded-2xl bg-white/80 px-4 py-3 text-xs text-slate-500">
            Preview starting bid: {listingPreview}
          </div>
        </section>
      )}

      {stepIndex === 2 && (
        <section className="surface-panel rounded-3xl p-4 space-y-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Photos (stored in Supabase)
            </p>
            <div className="mt-2 grid gap-3">
              <input
                type="file"
                multiple
                accept="image/*"
                capture="environment"
                onChange={handleImageChange}
                className="w-full rounded-2xl border border-dashed border-slate-200 bg-white/70 px-4 py-3 text-sm text-slate-600"
              />
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleImageChange}
                className="w-full rounded-2xl border border-dashed border-slate-200 bg-white/70 px-4 py-3 text-sm text-slate-600"
              />
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              Top: take photo. Bottom: upload from device.
            </p>
            {uploadMessage && (
              <div className="mt-3 rounded-2xl border border-slate-200 bg-white/70 px-3 py-2 text-xs text-slate-600">
                {uploadMessage}
              </div>
            )}
            {images.length > 0 && (
              <div className="mt-3 grid gap-2 grid-cols-2">
                {images.map((image) => (
                  <div
                    key={image.url}
                    className="overflow-hidden rounded-2xl border border-white/70 bg-white/70"
                  >
                    <div className="relative h-20 w-full">
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
            )}
          </div>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={status === "loading"}
            className="w-full rounded-full bg-[var(--royal)] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:bg-[var(--royal-deep)] disabled:opacity-60"
          >
            {status === "loading" ? "Creating..." : "Create listing"}
          </button>
          {message && (
            <div
              className={`rounded-2xl border px-4 py-3 text-xs ${
                status === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-red-200 bg-red-50 text-red-600"
              }`}
            >
              {message}
            </div>
          )}
          {listingId && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              Listing live.{" "}
              <Link
                href={`/streams/${listingId}`}
                className="font-semibold underline"
              >
                Open stream room
              </Link>
            </div>
          )}
        </section>
      )}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setStepIndex((prev) => Math.max(0, prev - 1))}
          className="rounded-full border border-slate-200 px-5 py-2 text-xs font-semibold text-slate-600"
          disabled={stepIndex === 0}
        >
          Back
        </button>
        <button
          type="button"
          onClick={() =>
            setStepIndex((prev) => Math.min(steps.length - 1, prev + 1))
          }
          className="rounded-full bg-slate-900 px-5 py-2 text-xs font-semibold text-white"
          disabled={stepIndex === steps.length - 1}
        >
          Next
        </button>
      </div>
    </div>
  );
}
