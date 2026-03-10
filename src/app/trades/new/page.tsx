"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { useCategories } from "@/hooks/useCategories";
import { fetchClientApi, normalizeClientError } from "@/lib/client-api";
import { formatCurrency } from "@/lib/format";

type TradeFormState = {
  title: string;
  description: string;
  category: string;
  cardSet: string;
  cardNumber: string;
  condition: string;
  gradeCompany: string;
  gradeLabel: string;
  certNumber: string;
  lookingFor: string;
  preferredBrands: string;
  location: string;
  shippingMode: string;
  tags: string;
  valueMin: string;
  valueMax: string;
  cashDirection: "NONE" | "PAY_ME" | "I_PAY";
  cashAmount: string;
};

const steps = ["Basics", "Value", "Media", "Preview"] as const;

const initialState: TradeFormState = {
  title: "",
  description: "",
  category: "",
  cardSet: "",
  cardNumber: "",
  condition: "",
  gradeCompany: "",
  gradeLabel: "",
  certNumber: "",
  lookingFor: "",
  preferredBrands: "",
  location: "",
  shippingMode: "",
  tags: "",
  valueMin: "",
  valueMax: "",
  cashDirection: "NONE",
  cashAmount: "",
};

function toIntOrNull(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.trunc(parsed);
}

function toSafeImageUrl(value: string) {
  const trimmed = value.trim();
  return /^https?:\/\/[^\s]+$/i.test(trimmed) ? trimmed : "";
}

function createUploadPreview(file: File, fallbackUrl: string) {
  try {
    return URL.createObjectURL(file);
  } catch {
    return fallbackUrl;
  }
}

async function uploadFiles(files: File[]) {
  const uploads: Array<{ url: string; previewUrl: string }> = [];
  for (const file of files) {
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetchClientApi("/api/trades/uploads", {
      method: "POST",
      body: formData,
    });
    const payload = (await response.json()) as { url?: string; error?: string };
    if (!response.ok || !payload.url) {
      throw new Error(payload.error || `Unable to upload ${file.name}`);
    }
    uploads.push({
      url: payload.url,
      previewUrl: createUploadPreview(file, payload.url),
    });
  }
  return uploads;
}

export default function NewTradePage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { data: categories } = useCategories();

  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState<TradeFormState>(initialState);
  const [images, setImages] = useState<Array<{ url: string; previewUrl?: string }>>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const inputClass =
    "w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-700 outline-none focus:border-[var(--royal)]";
  const labelClass = "text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400";

  const selectedCategory = useMemo(
    () => categories.find((entry) => entry.slug === form.category),
    [categories, form.category],
  );

  const tagPreview = useMemo(
    () => form.tags.split(",").map((entry) => entry.trim()).filter(Boolean).slice(0, 10),
    [form.tags],
  );

  const previewValueMin = toIntOrNull(form.valueMin);
  const previewValueMax = toIntOrNull(form.valueMax);

  const computedCashAdjustment = useMemo(() => {
    const amount = toIntOrNull(form.cashAmount) ?? 0;
    if (form.cashDirection === "PAY_ME") return Math.abs(amount);
    if (form.cashDirection === "I_PAY") return -Math.abs(amount);
    return 0;
  }, [form.cashAmount, form.cashDirection]);

  const update = (key: keyof TradeFormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const onUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    setError("");
    try {
      const next = await uploadFiles(files);
      setImages((prev) => [...prev, ...next].slice(0, 12));
      setStatus("Upload complete.");
      event.target.value = "";
    } catch (err) {
      setError(normalizeClientError(err, "Upload failed."));
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (url: string) => {
    setImages((prev) => {
      const removed = prev.find((entry) => entry.url === url);
      if (removed?.previewUrl?.startsWith("blob:")) {
        try {
          URL.revokeObjectURL(removed.previewUrl);
        } catch {
          // Ignore object URL cleanup failures.
        }
      }
      return prev.filter((entry) => entry.url !== url);
    });
  };

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.lookingFor.trim()) {
      setError("Title and looking-for details are required.");
      return;
    }

    setSubmitting(true);
    setError("");
    setStatus("");

    try {
      const response = await fetchClientApi("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          category: selectedCategory?.name ?? form.category,
          cardSet: form.cardSet,
          cardNumber: form.cardNumber,
          condition: form.condition,
          gradeCompany: form.gradeCompany,
          gradeLabel: form.gradeLabel,
          lookingFor: form.lookingFor,
          preferredBrands: form.preferredBrands,
          location: form.location,
          shippingMode: form.shippingMode,
          tags: form.tags.split(",").map((entry) => entry.trim()).filter(Boolean),
          valueMin: toIntOrNull(form.valueMin),
          valueMax: toIntOrNull(form.valueMax),
          images: images
            .map((image, index) => ({ url: toSafeImageUrl(image.url), isPrimary: index === 0 }))
            .filter((image) => image.url.length > 0),
        }),
      });
      const payload = (await response.json()) as { id?: string; error?: string };
      if (!response.ok || !payload.id) {
        throw new Error(payload.error || "Unable to create trade post.");
      }
      setStatus("Trade posted.");
      router.push(`/trades/${encodeURIComponent(payload.id)}`);
    } catch (err) {
      setError(normalizeClientError(err, "Unable to create trade post."));
    } finally {
      setSubmitting(false);
    }
  };

  if (!session?.user?.id) {
    return (
      <div className="ios-panel p-6">
        <h1 className="ios-title">Post trade</h1>
        <p className="mt-2 text-sm text-slate-600">Sign in to post a trade.</p>
        <button
          type="button"
          onClick={() => signIn()}
          className="mt-4 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
        >
          Sign in
        </button>
      </div>
    );
  }

  return (
    <div className="ios-screen">
      <section className="ios-hero space-y-3">
        <h1 className="ios-title">Post trade</h1>
      </section>

      <div className="surface-panel rounded-3xl p-4">
        <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-slate-400">
          {steps.map((step, index) => (
            <span key={step} className={index === stepIndex ? "text-slate-700" : ""}>
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

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      ) : null}

      {status ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {status}
        </div>
      ) : null}

      {stepIndex === 0 ? (
        <section className="surface-panel rounded-3xl p-4 space-y-4">
          <div className="space-y-2">
            <p className={labelClass}>Category</p>
            <select
              value={form.category}
              onChange={(event) => update("category", event.target.value)}
              className={inputClass}
            >
              <option value="">Primary category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.slug}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <p className={labelClass}>Title</p>
            <input
              value={form.title}
              onChange={(event) => update("title", event.target.value)}
              placeholder="Trade title"
              className={inputClass}
            />
          </div>

          <div className="space-y-2">
            <p className={labelClass}>Description</p>
            <textarea
              value={form.description}
              onChange={(event) => update("description", event.target.value)}
              rows={4}
              placeholder="Describe card details"
              className={inputClass}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <p className={labelClass}>Card set</p>
              <input
                value={form.cardSet}
                onChange={(event) => update("cardSet", event.target.value)}
                placeholder="Base set"
                className={inputClass}
              />
            </div>
            <div className="space-y-2">
              <p className={labelClass}>Card number</p>
              <input
                value={form.cardNumber}
                onChange={(event) => update("cardNumber", event.target.value)}
                placeholder="4/102"
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <p className={labelClass}>Condition</p>
              <input
                value={form.condition}
                onChange={(event) => update("condition", event.target.value)}
                placeholder="Near mint"
                className={inputClass}
              />
            </div>
            <div className="space-y-2">
              <p className={labelClass}>Grade</p>
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={form.gradeCompany}
                  onChange={(event) => update("gradeCompany", event.target.value)}
                  placeholder="PSA"
                  className={inputClass}
                />
                <input
                  value={form.gradeLabel}
                  onChange={(event) => update("gradeLabel", event.target.value)}
                  placeholder="10"
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <p className={labelClass}>Cert number</p>
            <input
              value={form.certNumber}
              onChange={(event) => update("certNumber", event.target.value)}
              placeholder="Certification #"
              className={inputClass}
            />
          </div>

          <div className="space-y-2">
            <p className={labelClass}>Looking for</p>
            <textarea
              value={form.lookingFor}
              onChange={(event) => update("lookingFor", event.target.value)}
              rows={3}
              placeholder="What cards or bundles you want in return"
              className={inputClass}
            />
          </div>
        </section>
      ) : null}

      {stepIndex === 1 ? (
        <section className="surface-panel rounded-3xl p-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <p className={labelClass}>Min value (USD)</p>
              <input
                value={form.valueMin}
                onChange={(event) => update("valueMin", event.target.value)}
                inputMode="numeric"
                placeholder="300"
                className={inputClass}
              />
            </div>
            <div className="space-y-2">
              <p className={labelClass}>Max value (USD)</p>
              <input
                value={form.valueMax}
                onChange={(event) => update("valueMax", event.target.value)}
                inputMode="numeric"
                placeholder="800"
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <p className={labelClass}>Shipping</p>
              <input
                value={form.shippingMode}
                onChange={(event) => update("shippingMode", event.target.value)}
                placeholder="Tracked + insured"
                className={inputClass}
              />
            </div>
            <div className="space-y-2">
              <p className={labelClass}>Location</p>
              <input
                value={form.location}
                onChange={(event) => update("location", event.target.value)}
                placeholder="NY, USA"
                className={inputClass}
              />
            </div>
          </div>

          <div className="space-y-2">
            <p className={labelClass}>Preferred brands</p>
            <input
              value={form.preferredBrands}
              onChange={(event) => update("preferredBrands", event.target.value)}
              placeholder="Pokemon, One Piece, vintage"
              className={inputClass}
            />
          </div>

          <div className="space-y-2">
            <p className={labelClass}>Tags (comma separated)</p>
            <input
              value={form.tags}
              onChange={(event) => update("tags", event.target.value)}
              placeholder="sealed, grail, psa10"
              className={inputClass}
            />
            {tagPreview.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {tagPreview.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-slate-200 bg-white/90 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white/70 p-3">
            <p className={labelClass}>Cash direction (optional)</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => update("cashDirection", "NONE")}
                className={`rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] ${
                  form.cashDirection === "NONE"
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-700"
                }`}
              >
                No cash
              </button>
              <button
                type="button"
                onClick={() => update("cashDirection", "PAY_ME")}
                className={`rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] ${
                  form.cashDirection === "PAY_ME"
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-700"
                }`}
              >
                Counterparty pays
              </button>
              <button
                type="button"
                onClick={() => update("cashDirection", "I_PAY")}
                className={`rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] ${
                  form.cashDirection === "I_PAY"
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-700"
                }`}
              >
                I pay
              </button>
            </div>
            {form.cashDirection !== "NONE" ? (
              <input
                value={form.cashAmount}
                onChange={(event) => update("cashAmount", event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none"
                inputMode="numeric"
                placeholder="Cash amount in cents"
              />
            ) : null}
          </div>
        </section>
      ) : null}

      {stepIndex === 2 ? (
        <section className="surface-panel rounded-3xl p-4 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white/80 p-3">
            <p className={labelClass}>Upload images</p>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              onChange={onUpload}
              className="mt-2 text-xs text-slate-600"
            />
            {uploading ? <p className="mt-2 text-xs text-slate-500">Uploading...</p> : null}
          </div>

          {images.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {images.map((image, index) => (
                <div key={image.url} className="rounded-2xl border border-slate-200 bg-white p-2">
                    <div className="relative h-24 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                      {image.previewUrl ? (
                        <img
                          src={image.previewUrl}
                          alt={`Trade upload ${index + 1}`}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-slate-500">Image</div>
                      )}
                    </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                      {index === 0 ? "Primary" : `Image ${index + 1}`}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeImage(image.url)}
                      className="rounded-full border border-red-200 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="ios-empty">Add at least one image for better offers.</div>
          )}
        </section>
      ) : null}

      {stepIndex === 3 ? (
        <section className="surface-panel rounded-3xl p-4 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
            <p className="font-display text-xl text-slate-900">{form.title || "Untitled trade"}</p>
            <p className="mt-2 text-sm text-slate-600">{form.lookingFor || "Looking-for details"}</p>
            <p className="mt-2 text-xs text-slate-500">
              {previewValueMin !== null || previewValueMax !== null
                ? `${previewValueMin !== null ? formatCurrency(previewValueMin, "USD") : "-"} to ${previewValueMax !== null ? formatCurrency(previewValueMax, "USD") : "-"}`
                : "Open value"}
            </p>
            {computedCashAdjustment !== 0 ? (
              <p className="mt-2 text-xs text-slate-500">
                Cash term: {computedCashAdjustment > 0 ? "counterparty pays" : "you pay"} {formatCurrency(Math.abs(computedCashAdjustment), "USD")}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            {tagPreview.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-slate-200 bg-white/90 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600"
              >
                {tag}
              </span>
            ))}
          </div>

          <p className="text-xs text-slate-500">
            After publishing, you can accept, decline, or counter offers, and Stripe checkout is used when cash is part of a deal.
          </p>
        </section>
      ) : null}

      <section className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setStepIndex((prev) => Math.max(prev - 1, 0))}
            disabled={stepIndex === 0}
            className="rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700 disabled:opacity-50"
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => setStepIndex((prev) => Math.min(prev + 1, steps.length - 1))}
            disabled={stepIndex === steps.length - 1}
            className="rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700 disabled:opacity-50"
          >
            Next
          </button>
        </div>

        <div className="flex gap-2">
          <Link
            href="/trades"
            className="rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700"
          >
            Cancel
          </Link>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={submitting || uploading}
            className="rounded-full bg-slate-900 px-5 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white disabled:opacity-60"
          >
            {submitting ? "Posting..." : "Post trade"}
          </button>
        </div>
      </section>
    </div>
  );
}
