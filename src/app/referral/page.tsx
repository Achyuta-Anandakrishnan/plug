export default function ReferralPage() {
  return (
    <div className="ios-screen">
      <section className="ios-hero grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <p className="ios-kicker">
            Referral program
          </p>
          <h1 className="ios-title">
            Bring serious sellers. Earn better placement.
          </h1>
          <p className="ios-subtitle">
            Bring in strong operators and unlock lower fees, better discovery,
            and faster access to premium seller tools.
          </p>
          <div className="flex flex-wrap gap-3">
            <button className="rounded-full bg-[var(--royal)] px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/30">
              Copy referral link
            </button>
            <button className="rounded-full border border-slate-200 bg-white/90 px-6 py-3.5 text-sm font-semibold text-slate-700">
              Share via text
            </button>
          </div>
        </div>
        <div className="ios-panel p-6">
          <p className="ios-kicker">
            Your link
          </p>
          <div className="mt-4 rounded-[22px] border border-white/70 bg-white/70 px-4 py-4 text-sm text-slate-700">
            vyre.live/ref/sky-aurora-92
          </div>
          <div className="mt-4 grid gap-3 text-sm text-slate-600">
            <div className="ios-panel-muted flex items-center justify-between rounded-[22px] px-4 py-4">
              <span>Successful referrals</span>
              <span className="font-semibold text-slate-800">7</span>
            </div>
            <div className="ios-panel-muted flex items-center justify-between rounded-[22px] px-4 py-4">
              <span>Pending verification</span>
              <span className="font-semibold text-slate-800">3</span>
            </div>
            <div className="ios-panel-muted flex items-center justify-between rounded-[22px] px-4 py-4">
              <span>Unlocked fee discount</span>
              <span className="font-semibold text-slate-800">-12%</span>
            </div>
          </div>
        </div>
      </section>

      <section className="ios-panel p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="ios-kicker">
              Rewards
            </p>
            <h2 className="ios-section-title">
              Better sellers create better rewards.
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
              className="ios-panel-muted rounded-[24px] p-5"
            >
              <p className="font-display text-lg text-slate-900">
                {item.title}
              </p>
              <p className="text-sm text-slate-500">{item.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="ios-panel p-6 sm:p-8">
          <h3 className="font-display text-2xl text-slate-900">Invite checklist</h3>
          <ul className="mt-4 list-disc space-y-3 pl-5 text-sm text-slate-600">
            <li>Confirm seller has ownership documentation.</li>
            <li>Encourage a clean inventory intake sheet.</li>
            <li>Share the seller prep guide.</li>
          </ul>
        </div>
        <div className="ios-panel p-6 sm:p-8">
          <h3 className="font-display text-2xl text-slate-900">
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
