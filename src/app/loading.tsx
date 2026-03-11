import { CheckersLoader } from "@/components/CheckersLoader";

export default function Loading() {
  return (
    <div className="flex min-h-[calc(100vh-180px)] items-center justify-center px-4 py-8">
      <div className="glass-panel w-full max-w-[min(92vw,460px)] rounded-[32px] p-[clamp(1.25rem,4vw,2.5rem)] text-center">
        <CheckersLoader title="Loading" />
      </div>
    </div>
  );
}
