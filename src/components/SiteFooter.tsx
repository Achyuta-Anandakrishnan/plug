import Image from "next/image";

export function SiteFooter() {
  return (
    <footer className="hidden border-t border-white/50 bg-white/80 md:block">
      <div className="page-container py-6 text-sm text-slate-600 md:flex md:items-center md:justify-between md:gap-6 md:py-12">
        <div className="hidden items-center gap-3 md:flex">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white/90 shadow-lg shadow-black/20">
            <Image src="/dalow-logo.svg" alt="dalow logo" width={22} height={22} />
          </div>
          <div>
            <p className="font-display text-base text-slate-900">dalow</p>
            <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">
              Live Commerce
            </p>
          </div>
        </div>
        <div className="hidden flex-wrap gap-5 text-xs uppercase tracking-[0.24em] text-slate-400 md:flex">
          <span>Live</span>
          <span>Auctions</span>
          <span>Trades</span>
          <span>Collectors</span>
        </div>
        <p className="text-center text-[11px] text-slate-400 md:text-left">© 2026 dalow Labs</p>
      </div>
    </footer>
  );
}
