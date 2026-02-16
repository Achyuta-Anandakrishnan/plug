export default function ReferralPage() {
  return (
    <div className="space-y-10">
      <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
            Referral program
          </p>
          <h1 className="font-display text-3xl text-slate-900 sm:text-4xl">
            Bring trusted sellers. Earn priority perks.
          </h1>
          <p className="text-sm leading-relaxed text-slate-600">
            Invite verified sellers to Vyre and unlock reduced fees, boosted
            visibility, and faster escrow releases.
          </p>
          <div className="flex flex-wrap gap-3">
            <button className="rounded-full bg-[var(--royal)] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/30">
              Copy referral link
            </button>
            <button className="rounded-full border border-slate-200 px-6 py-3 text-sm font-semibold text-slate-700">
              Share via text
            </button>
          </div>
        </div>
        <div className="glass-panel rounded-[32px] p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
            Your link
          </p>
          <div className="mt-4 rounded-2xl border border-white/70 bg-white/70 px-4 py-3 text-sm text-slate-700">
            vyre.live/ref/sky-aurora-92
          </div>
          <div className="mt-4 grid gap-3 text-sm text-slate-600">
            <div className="flex items-center justify-between rounded-2xl bg-white/70 px-4 py-3">
              <span>Successful referrals</span>
              <span className="font-semibold text-slate-800">7</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-white/70 px-4 py-3">
              <span>Pending verification</span>
              <span className="font-semibold text-slate-800">3</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-white/70 px-4 py-3">
              <span>Unlocked fee discount</span>
              <span className="font-semibold text-slate-800">-12%</span>
            </div>
          </div>
        </div>
      </section>

      <section className="surface-panel rounded-[32px] p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
              Rewards
            </p>
            <h2 className="font-display text-2xl text-slate-900">
              Priority perks stack by trust.
            </h2>
          </div>
          <span className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white">
            Invite 3+ sellers
          </span>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            {
              title: "Fee reduction",
              detail: "Up to 18% lower platform fees.",
            },
            {
              title: "Stream visibility",
              detail: "Boosted placement in live stream feed.",
            },
            {
              title: "Faster payouts",
              detail: "Escrow holds reduced after 10 clean sales.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-white/70 bg-white/70 p-5"
            >
              <p className="font-display text-lg text-slate-900">
                {item.title}
              </p>
              <p className="text-sm text-slate-500">{item.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="surface-panel rounded-[32px] p-8">
          <h3 className="font-display text-xl text-slate-900">Invite checklist</h3>
          <ul className="mt-4 list-disc space-y-3 pl-5 text-sm text-slate-600">
            <li>Confirm seller has ownership documentation.</li>
            <li>Encourage a clean inventory intake sheet.</li>
            <li>Share the seller prep guide.</li>
          </ul>
        </div>
        <div className="surface-panel rounded-[32px] p-8">
          <h3 className="font-display text-xl text-slate-900">
            Referral tracking
          </h3>
          <p className="mt-3 text-sm text-slate-600">
            Track every invite from click to verification. Dedicated success
            managers guide your referrals through the review steps.
          </p>
        </div>
      </section>
    </div>
  );
}
