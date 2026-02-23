"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { signIn, useSession } from "next-auth/react";
import { useCategories } from "@/hooks/useCategories";
import { formatCurrency } from "@/lib/format";
import {
  GRADING_COMPANIES,
  type GradePrecision,
  getGradeOptions,
  getGradingProfile,
} from "@/lib/grading";

const listingTypes = [
  { label: "Auction", value: "AUCTION" },
  { label: "Buy Now", value: "BUY_NOW" },
  { label: "Both", value: "BOTH" },
] as const;

function nextSundayAtEightLocal() {
  const now = new Date();
  const target = new Date();
  target.setHours(20, 0, 0, 0);
  const day = target.getDay();
  const daysUntil = (7 - day) % 7;
  target.setDate(target.getDate() + daysUntil);
  if (target <= now) {
    target.setDate(target.getDate() + 7);
  }
  return target.toISOString().slice(0, 16);
}

function toCents(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed * 100);
}

export function SellerListingDesktop() {
  const { data: categories } = useCategories();
  const { data: session } = useSession();
  const isSeller =
    session?.user?.role === "SELLER" || session?.user?.role === "ADMIN";
  const sessionSellerId = isSeller ? session?.user?.id ?? "" : "";
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
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState(nextSundayAtEightLocal());
  const [publishNow, setPublishNow] = useState(true);
  const [videoStreamUrl, setVideoStreamUrl] = useState("");
  const [isGraded, setIsGraded] = useState<"YES" | "NO">("NO");
  const [gradingCompany, setGradingCompany] = useState("PSA");
  const [gradePrecision, setGradePrecision] = useState<GradePrecision>(
    getGradingProfile("PSA").defaultPrecision,
  );
  const [grade, setGrade] = useState("");
  const [gradingLabel, setGradingLabel] = useState("");
  const [certNumber, setCertNumber] = useState("");
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
    () => getGradeOptions(gradingCompany, gradePrecision),
    [gradePrecision, gradingCompany],
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

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("loading");
    setMessage("");

    const payload = {
      listingType,
      title,
      description,
      startingBid: listingType !== "BUY_NOW" ? toCents(startingBid) : undefined,
      buyNowPrice: listingType !== "AUCTION" ? toCents(buyNowPrice) : undefined,
      minBidIncrement: minBidIncrement ? toCents(minBidIncrement) : undefined,
      startTime: startTime ? new Date(startTime).toISOString() : undefined,
      endTime: endTime ? new Date(endTime).toISOString() : undefined,
      publishNow,
      currency: "usd",
      categoryId: categoryId || undefined,
      videoStreamUrl: videoStreamUrl || undefined,
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
    } as const;

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

  return (
    <div className="space-y-10">
      <section className="space-y-6">
        <div className="space-y-6">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
            Seller desk
          </p>
          <h1 className="font-display text-3xl text-slate-900 sm:text-4xl">
            Create a live listing.
          </h1>
          <p className="text-sm leading-relaxed text-slate-600">
            List as auction, buy now, or both. Buyers can bid in real time.
          </p>
          <div className="flex flex-wrap gap-3">
          </div>
          {sessionSellerId ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-700">
              Signed in as {session?.user?.email ?? "seller"}.
            </div>
          ) : (
            <div className="grid gap-2">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
                {session?.user?.id
                  ? "Your account is not a seller yet. Submit seller verification for manual review."
                  : "Sign in to publish live listings."}
              </div>
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
        </div>
      </section>

      <section className="surface-panel rounded-[32px] p-5 sm:p-8">
        <form className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]" onSubmit={handleSubmit}>
          <div className="space-y-5">
            <div className="rounded-3xl border border-white/70 bg-white/60 p-5">
              <p className="font-display text-lg text-slate-900">Listing details</p>
              <div className="mt-4 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
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
                  <div className="grid gap-3 sm:grid-cols-2">
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
                      <div className="space-y-2">
                        <p className={labelClass}>Grading company</p>
                        <select
                          value={gradingCompany}
                          onChange={(event) => {
                            const nextCompany = event.target.value;
                            const nextProfile = getGradingProfile(nextCompany);
                            setGradingCompany(nextCompany);
                            setGradePrecision(nextProfile.defaultPrecision);
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
                    )}
                  </div>
                  {isGraded === "YES" && (
                    <div className="space-y-3">
                      <p className="text-xs text-slate-500">{gradingProfile.note}</p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {gradingProfile.supportsHalfGrades && (
                          <div className="space-y-2">
                            <p className={labelClass}>Grade increments</p>
                            <select
                              value={gradePrecision}
                              onChange={(event) => {
                                setGradePrecision(event.target.value as GradePrecision);
                                setGrade("");
                              }}
                              className={inputClass}
                            >
                              <option value="WHOLE">Whole numbers</option>
                              <option value="HALF">Half points (.5)</option>
                            </select>
                          </div>
                        )}
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
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
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
                        <div className="space-y-2">
                          <p className={labelClass}>Cert number</p>
                          <input
                            value={certNumber}
                            onChange={(event) => setCertNumber(event.target.value)}
                            placeholder="Certification #"
                            className={inputClass}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-white/70 bg-white/60 p-5">
              <p className="font-display text-lg text-slate-900">Media uploads</p>
              <p className="mt-1 text-xs text-slate-500">
                Stored in Supabase bucket. First image becomes primary.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
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
              {uploadMessage && (
                <div className="mt-3 rounded-2xl border border-slate-200 bg-white/70 px-3 py-2 text-xs text-slate-600">
                  {uploadMessage}
                </div>
              )}
              {images.length > 0 && (
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {images.map((image) => (
                    <div
                      key={image.url}
                      className="overflow-hidden rounded-2xl border border-white/70 bg-white/70"
                    >
                      <div className="relative h-24 w-full">
                        <Image
                          src={image.previewUrl ?? image.url}
                          alt="Upload preview"
                          fill
                          sizes="200px"
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-3xl border border-white/70 bg-white/60 p-4">
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                Live preview
              </p>
              <p className="mt-1 font-display text-2xl text-slate-900">
                {listingPreview}
              </p>
              <p className="text-xs text-slate-500">
                Starting price preview in USD.
              </p>
            </div>
            <div className="grid gap-3">
              {listingTypes.map((type) => (
                <button
                  type="button"
                  key={type.value}
                  onClick={() => setListingType(type.value)}
                  className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold ${
                    listingType === type.value
                      ? "border-[var(--royal)] bg-blue-50 text-[var(--royal)]"
                      : "border-slate-200 text-slate-600"
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>

            {listingType !== "BUY_NOW" && (
              <div className="space-y-2">
                <p className={labelClass}>Starting bid (USD)</p>
                <input
                  value={startingBid}
                  onChange={(event) => setStartingBid(event.target.value)}
                  placeholder="Starting bid (USD)"
                  className={inputClass}
                />
              </div>
            )}
            {listingType !== "AUCTION" && (
              <div className="space-y-2">
                <p className={labelClass}>Buy now price (USD)</p>
                <input
                  value={buyNowPrice}
                  onChange={(event) => setBuyNowPrice(event.target.value)}
                  placeholder="Buy now price (USD)"
                  className={inputClass}
                />
              </div>
            )}
            <div className="space-y-2">
              <p className={labelClass}>Min bid increment (USD)</p>
              <input
                value={minBidIncrement}
                onChange={(event) => setMinBidIncrement(event.target.value)}
                placeholder="Min bid increment (USD)"
                className={inputClass}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <p className={labelClass}>Start time</p>
                <input
                  type="datetime-local"
                  value={startTime}
                  onChange={(event) => setStartTime(event.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="space-y-2">
                <p className={labelClass}>End time</p>
                <input
                  type="datetime-local"
                  value={endTime}
                  onChange={(event) => setEndTime(event.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
            <div className="space-y-2">
              <p className={labelClass}>Stream playback URL</p>
              <input
                value={videoStreamUrl}
                onChange={(event) => setVideoStreamUrl(event.target.value)}
                placeholder="Stream playback URL (optional)"
                className={inputClass}
              />
            </div>
            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={publishNow}
                onChange={(event) => setPublishNow(event.target.checked)}
              />
              Publish immediately (otherwise stays draft)
            </label>
            <button
              type="submit"
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
          </div>
        </form>
      </section>

      <section className="surface-panel rounded-[32px] p-8">
        <h3 className="font-display text-xl text-slate-900">Preview</h3>
        <p className="mt-2 text-sm text-slate-600">
          Current bid preview: {listingPreview}
        </p>
      </section>
    </div>
  );
}
