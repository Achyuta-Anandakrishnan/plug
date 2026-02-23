"use client";

import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { useState } from "react";

type MessageUserButtonProps = {
  targetUserId: string;
  className?: string;
  label?: string;
};

export function MessageUserButton({ targetUserId, className, label = "Message" }: MessageUserButtonProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    const me = session?.user?.id;
    if (!me) {
      await signIn();
      return;
    }
    if (me === targetUserId) return;

    setLoading(true);
    try {
      const response = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantIds: [me, targetUserId],
          subject: null,
        }),
      });
      const payload = (await response.json()) as { id?: string; error?: string };
      if (!response.ok || !payload.id) {
        setLoading(false);
        return;
      }
      router.push(`/messages?c=${encodeURIComponent(payload.id)}`);
    } catch {
      setLoading(false);
      return;
    }
    setLoading(false);
  };

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={loading || session?.user?.id === targetUserId}
      className={className ?? "rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-xs font-semibold text-slate-700 disabled:opacity-60"}
    >
      {loading ? "Opening..." : label}
    </button>
  );
}
