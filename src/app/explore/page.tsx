import { categories } from "@/lib/mock";

export default function ExplorePage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">
          Explore
        </p>
        <h1 className="font-display text-3xl text-slate-900">Categories</h1>
      </div>

      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:grid-cols-3">
        {categories.map((category) => (
          <div
            key={category.name}
            className="surface-panel rounded-2xl p-4 text-sm text-slate-600"
          >
            <p className="font-display text-base text-slate-900">
              {category.name}
            </p>
            <p className="text-xs text-slate-500">{category.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
