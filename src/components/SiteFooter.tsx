import Image from "next/image";

export function SiteFooter() {
  return (
    <footer className="border-t border-white/50 bg-white/80">
      <div className="page-container py-6 text-sm text-slate-600 md:flex md:items-center md:justify-between md:gap-6 md:py-12">
        <div className="hidden items-center gap-3 md:flex">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white/90 shadow-lg shadow-blue-500/20">
            <Image src="/vyre-mark.svg" alt="Vyre logo" width={22} height={22} />
          </div>
          <div>
            <p className="font-display text-base text-slate-900">Vyre</p>
            <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">
              Trust-first live sales
            </p>
          </div>
        </div>
        <div className="hidden flex-wrap gap-5 text-xs uppercase tracking-[0.24em] text-slate-400 md:flex">
          <span>Buyer Protection</span>
          <span>Secure Escrow</span>
          <span>Verified Sellers</span>
        </div>
        <p className="text-center text-[11px] text-slate-400 md:text-left">© 2026 Vyre Labs</p>
      </div>
    </footer>
  );
}
