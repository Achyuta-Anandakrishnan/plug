"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { signIn, useSession } from "next-auth/react";
import { useCategories } from "@/hooks/useCategories";
import { formatCurrency } from "@/lib/format";

const steps = ["Basics", "Pricing", "Media"] as const;

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
  const [sellerId, setSellerId] = useState("");
  const [buyerId, setBuyerId] = useState("");
  const [listingId, setListingId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [condition, setCondition] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [listingType, setListingType] = useState("AUCTION");
  const [startingBid, setStartingBid] = useState("100");
  const [buyNowPrice, setBuyNowPrice] = useState("250");
  const [reservePrice, setReservePrice] = useState("");
  const [minBidIncrement, setMinBidIncrement] = useState("20");
  const [endTime, setEndTime] = useState(nextSundayAtEightLocal());
  const [publishNow, setPublishNow] = useState(true);
  const [videoStreamUrl, setVideoStreamUrl] = useState("");
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

  useEffect(() => {
    if (!sessionSellerId && sellerId) {
      window.localStorage.setItem("vyre-seller-id", sellerId);
    }
    if (!sessionSellerId && buyerId) {
      window.localStorage.setItem("vyre-buyer-id", buyerId);
    }
  }, [buyerId, sellerId, sessionSellerId]);

  const handleSeed = async () => {
    setStatus("loading");
    setMessage("");
    try {
      const response = await fetch("/api/dev/seed", { method: "POST" });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Unable to seed.");
      }
      if (data.sellerProfileId) {
        setSellerId(data.sellerProfileId);
      }
      if (data.buyerId) {
        setBuyerId(data.buyerId);
      }
      setStatus("success");
      setMessage("Dev seller and buyer created.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unable to seed.");
    }
  };

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
      sellerId: sessionSellerId ? undefined : sellerId || undefined,
      listingType,
      title,
      description,
      startingBid: listingType !== "BUY_NOW" ? toCents(startingBid) : undefined,
      buyNowPrice: listingType !== "AUCTION" ? toCents(buyNowPrice) : undefined,
      reservePrice: reservePrice ? toCents(reservePrice) : undefined,
      minBidIncrement: minBidIncrement ? toCents(minBidIncrement) : undefined,
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

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
          Seller desk
        </p>
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
      </div>

      {stepIndex === 0 && (
        <section className="space-y-4">
          <button
            type="button"
            onClick={handleSeed}
            className="w-full rounded-full border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700"
          >
            Create dev seller/buyer
          </button>
          {buyerId && !sessionSellerId && (
            <div className="rounded-2xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white">
              Dev buyer: {buyerId.slice(0, 6)}...
            </div>
          )}
          {sessionSellerId ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-700">
              Signed in as {session?.user?.email ?? "seller"}.
            </div>
          ) : (
            <div className="grid gap-2">
              {session?.user?.id && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
                  Your account is not a seller yet. Use a dev seller ID or apply
                  for verification.
                </div>
              )}
              <input
                value={sellerId}
                onChange={(event) => setSellerId(event.target.value)}
                placeholder="Seller profile id (optional)"
                className="w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-700 outline-none focus:border-[var(--royal)]"
              />
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
          <select
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-700 outline-none focus:border-[var(--royal)]"
          >
            <option value="">Primary category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Listing title"
            className="w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-700 outline-none focus:border-[var(--royal)]"
            required
          />
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Description"
            rows={4}
            className="w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-700 outline-none focus:border-[var(--royal)]"
          />
          <input
            value={condition}
            onChange={(event) => setCondition(event.target.value)}
            placeholder="Condition / grade"
            className="w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-700 outline-none focus:border-[var(--royal)]"
          />
        </section>
      )}

      {stepIndex === 1 && (
        <section className="space-y-4">
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
              className="w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-700 outline-none focus:border-[var(--royal)]"
            />
          )}
          {listingType !== "AUCTION" && (
            <input
              value={buyNowPrice}
              onChange={(event) => setBuyNowPrice(event.target.value)}
              placeholder="Buy now price (USD)"
              className="w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-700 outline-none focus:border-[var(--royal)]"
            />
          )}
          {listingType !== "BUY_NOW" && (
            <input
              value={reservePrice}
              onChange={(event) => setReservePrice(event.target.value)}
              placeholder="Reserve price (USD, optional)"
              className="w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-700 outline-none focus:border-[var(--royal)]"
            />
          )}
          <input
            value={minBidIncrement}
            onChange={(event) => setMinBidIncrement(event.target.value)}
            placeholder="Min bid increment (USD)"
            className="w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-700 outline-none focus:border-[var(--royal)]"
          />
          <input
            type="datetime-local"
            value={endTime}
            onChange={(event) => setEndTime(event.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-700 outline-none focus:border-[var(--royal)]"
          />
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
        <section className="space-y-4">
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
          <input
            value={videoStreamUrl}
            onChange={(event) => setVideoStreamUrl(event.target.value)}
            placeholder="Stream playback URL (optional)"
            className="w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-700 outline-none focus:border-[var(--royal)]"
          />
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
