import Image from "next/image";

export default function Loading() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="glass-panel flex w-full max-w-md flex-col items-center gap-6 rounded-[32px] p-10 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/90 shadow-lg shadow-blue-500/20">
          <Image src="/vyre-mark.svg" alt="Vyre logo" width={30} height={30} />
        </div>
        <div>
          <p className="font-display text-2xl text-slate-900">
            Preparing secure room
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Encrypting stream, verifying bidders, syncing escrow.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full border-4 border-blue-100 border-t-[var(--royal)] animate-spin" />
          <div className="space-y-2">
            <div className="h-2 w-40 rounded-full bg-white/80" />
            <div className="h-2 w-32 rounded-full bg-white/60" />
          </div>
        </div>
      </div>
    </div>
  );
}
