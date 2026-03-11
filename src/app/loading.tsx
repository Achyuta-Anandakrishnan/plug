import { CheckersLoader } from "@/components/CheckersLoader";

export default function Loading() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="glass-panel w-full max-w-md rounded-[32px] p-10 text-center">
        <CheckersLoader title="Loading" />
      </div>
    </div>
  );
}
