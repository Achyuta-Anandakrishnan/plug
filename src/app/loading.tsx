import { CheckersLoader } from "@/components/CheckersLoader";

export default function Loading() {
  return (
    <div className="app-loading-screen">
      <CheckersLoader title="Loading" />
    </div>
  );
}
