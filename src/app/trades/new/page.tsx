"use client";

import { ChangeEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";

type TradeFormState = {
  title: string;
  description: string;
  category: string;
  cardSet: string;
  cardNumber: string;
  condition: string;
  gradeCompany: string;
  gradeLabel: string;
  lookingFor: string;
  preferredBrands: string;
  location: string;
  shippingMode: string;
  tags: string;
  valueMin: string;
  valueMax: string;
};

const initialState: TradeFormState = {
  title: "",
  description: "",
  category: "",
  cardSet: "",
  cardNumber: "",
  condition: "",
  gradeCompany: "",
  gradeLabel: "",
  lookingFor: "",
  preferredBrands: "",
  location: "",
  shippingMode: "",
  tags: "",
  valueMin: "",
  valueMax: "",
};

async function uploadFiles(files: File[]) {
  const urls: string[] = [];
  for (const file of files) {
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch("/api/trades/uploads", {
      method: "POST",
      body: formData,
    });
    const payload = (await response.json()) as { url?: string; error?: string };
    if (!response.ok || !payload.url) {
      throw new Error(payload.error || `Unable to upload ${file.name}`);
    }
    urls.push(payload.url);
  }
  return urls;
}

export default function NewTradePage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [form, setForm] = useState<TradeFormState>(initialState);
  const [imageInput, setImageInput] = useState("");
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const tagPreview = useMemo(
    () => form.tags.split(",").map((entry) => entry.trim()).filter(Boolean).slice(0, 10),
    [form.tags],
  );

  const update = (key: keyof TradeFormState) => (value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const onUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    setError("");
    try {
      const urls = await uploadFiles(files);
      setImageUrls((prev) => [...prev, ...urls].slice(0, 12));
      event.target.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const addImageUrl = () => {
    const value = imageInput.trim();
    if (!value) return;
    setImageUrls((prev) => [...prev, value].slice(0, 12));
    setImageInput("");
  };

  const removeImage = (url: string) => {
    setImageUrls((prev) => prev.filter((entry) => entry !== url));
  };

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.lookingFor.trim()) {
      setError("Title and looking-for details are required.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          tags: form.tags.split(",").map((entry) => entry.trim()).filter(Boolean),
          valueMin: form.valueMin ? Number(form.valueMin) : null,
          valueMax: form.valueMax ? Number(form.valueMax) : null,
          images: imageUrls.map((url, index) => ({ url, isPrimary: index === 0 })),
        }),
      });
      const payload = (await response.json()) as { id?: string; error?: string };
      if (!response.ok || !payload.id) {
        throw new Error(payload.error || "Unable to create trade post.");
      }
      router.push(`/trades/${payload.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create trade post.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!session?.user?.id) {
    return (
      <div className="ios-panel p-6">
        <h1 className="ios-title">New trade</h1>
        <p className="mt-2 text-sm text-slate-600">Sign in to create a trade post.</p>
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
        <h1 className="ios-title">New trade</h1>
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      ) : null}

      <section className="ios-panel p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm text-slate-600">
            Title
            <input
              value={form.title}
              onChange={(event) => update("title")(event.target.value)}
              className="ios-input mt-2"
              placeholder="PSA 10 Charizard + cash"
            />
          </label>
          <label className="text-sm text-slate-600">
            Category
            <input
              value={form.category}
              onChange={(event) => update("category")(event.target.value)}
              className="ios-input mt-2"
              placeholder="Pokemon"
            />
          </label>
          <label className="text-sm text-slate-600">
            Card set
            <input
              value={form.cardSet}
              onChange={(event) => update("cardSet")(event.target.value)}
              className="ios-input mt-2"
              placeholder="Base Set"
            />
          </label>
          <label className="text-sm text-slate-600">
            Card number
            <input
              value={form.cardNumber}
              onChange={(event) => update("cardNumber")(event.target.value)}
              className="ios-input mt-2"
              placeholder="4/102"
            />
          </label>
          <label className="text-sm text-slate-600">
            Condition
            <input
              value={form.condition}
              onChange={(event) => update("condition")(event.target.value)}
              className="ios-input mt-2"
              placeholder="Near mint"
            />
          </label>
          <label className="text-sm text-slate-600">
            Grade
            <div className="mt-2 grid gap-2 grid-cols-2">
              <input
                value={form.gradeCompany}
                onChange={(event) => update("gradeCompany")(event.target.value)}
                className="ios-input"
                placeholder="PSA"
              />
              <input
                value={form.gradeLabel}
                onChange={(event) => update("gradeLabel")(event.target.value)}
                className="ios-input"
                placeholder="10"
              />
            </div>
          </label>
          <label className="sm:col-span-2 text-sm text-slate-600">
            Looking for
            <textarea
              value={form.lookingFor}
              onChange={(event) => update("lookingFor")(event.target.value)}
              className="mt-2 min-h-24 w-full rounded-3xl border border-slate-200 bg-white/95 px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-400"
              placeholder="Raw alt arts + cash"
            />
          </label>
          <label className="sm:col-span-2 text-sm text-slate-600">
            Description
            <textarea
              value={form.description}
              onChange={(event) => update("description")(event.target.value)}
              className="mt-2 min-h-24 w-full rounded-3xl border border-slate-200 bg-white/95 px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-400"
              placeholder="Any damage notes, bundle details, timeline"
            />
          </label>
          <label className="text-sm text-slate-600">
            Shipping
            <input
              value={form.shippingMode}
              onChange={(event) => update("shippingMode")(event.target.value)}
              className="ios-input mt-2"
              placeholder="Tracked + insured"
            />
          </label>
          <label className="text-sm text-slate-600">
            Location
            <input
              value={form.location}
              onChange={(event) => update("location")(event.target.value)}
              className="ios-input mt-2"
              placeholder="NY, USA"
            />
          </label>
          <label className="text-sm text-slate-600">
            Min value (USD)
            <input
              value={form.valueMin}
              onChange={(event) => update("valueMin")(event.target.value)}
              className="ios-input mt-2"
              inputMode="numeric"
              placeholder="350"
            />
          </label>
          <label className="text-sm text-slate-600">
            Max value (USD)
            <input
              value={form.valueMax}
              onChange={(event) => update("valueMax")(event.target.value)}
              className="ios-input mt-2"
              inputMode="numeric"
              placeholder="700"
            />
          </label>
          <label className="sm:col-span-2 text-sm text-slate-600">
            Preferred brands / tags
            <input
              value={form.preferredBrands}
              onChange={(event) => update("preferredBrands")(event.target.value)}
              className="ios-input mt-2"
              placeholder="Pokemon, One Piece, vintage"
            />
          </label>
          <label className="sm:col-span-2 text-sm text-slate-600">
            Tag list (comma separated)
            <input
              value={form.tags}
              onChange={(event) => update("tags")(event.target.value)}
              className="ios-input mt-2"
              placeholder="sealed, grail, psa10"
            />
          </label>
          {tagPreview.length > 0 ? (
            <div className="sm:col-span-2 flex flex-wrap gap-2">
              {tagPreview.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-slate-200 bg-white/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div className="mt-5 rounded-3xl border border-slate-200 bg-white/80 p-4">
          <p className="text-sm font-semibold text-slate-800">Images</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            <input
              value={imageInput}
              onChange={(event) => setImageInput(event.target.value)}
              className="ios-input"
              placeholder="Paste image URL"
            />
            <button
              type="button"
              onClick={addImageUrl}
              className="rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700"
            >
              Add URL
            </button>
          </div>
          <div className="mt-3">
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              onChange={onUpload}
              className="text-xs text-slate-600"
            />
            {uploading ? <p className="mt-2 text-xs text-slate-500">Uploading...</p> : null}
          </div>
          {imageUrls.length > 0 ? (
            <div className="mt-3 grid gap-2">
              {imageUrls.map((url, index) => (
                <div key={url} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/90 px-3 py-2">
                  <p className="truncate text-xs text-slate-600">{url}</p>
                  <div className="flex items-center gap-2">
                    {index === 0 ? (
                      <span className="rounded-full border border-slate-300 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Primary
                      </span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => removeImage(url)}
                      className="rounded-full border border-red-200 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || uploading}
            className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {submitting ? "Posting..." : "Post trade"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/trades")}
            className="rounded-full border border-slate-200 bg-white/90 px-5 py-2.5 text-sm font-semibold text-slate-700"
          >
            Cancel
          </button>
        </div>
      </section>
    </div>
  );
}
