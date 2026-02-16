"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const initialBids = [
  { id: "b1", bidder: "Nova", amount: 1220, time: "00:44" },
  { id: "b2", bidder: "Aria", amount: 1240, time: "00:37" },
  { id: "b3", bidder: "You", amount: 1260, time: "00:28" },
];

const initialChat = [
  { id: "c1", sender: "Host", text: "Sealed box close-up in 10s." },
  { id: "c2", sender: "Moonlight", text: "Any scratches on the seal?" },
  { id: "c3", sender: "Host", text: "None. Full wrap, no tears." },
];

function formatTime(totalSeconds: number) {
  const minutes = Math.max(0, Math.floor(totalSeconds / 60));
  const seconds = Math.max(0, totalSeconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function LiveAuctionRoom() {
  const [timeLeft, setTimeLeft] = useState(86);
  const [currentBid, setCurrentBid] = useState(1280);
  const [bidCount, setBidCount] = useState(14);
  const [bids, setBids] = useState(initialBids);
  const [chat, setChat] = useState(initialChat);
  const [message, setMessage] = useState("");
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState("");
  const primaryVideoRef = useRef<HTMLVideoElement | null>(null);
  const detailVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!cameraStream) return;

    const videos = [primaryVideoRef.current, detailVideoRef.current];
    videos.forEach((video) => {
      if (!video) return;
      video.srcObject = cameraStream;
      video.play().catch(() => undefined);
    });

    return () => {
      videos.forEach((video) => {
        if (video) video.srcObject = null;
      });
    };
  }, [cameraStream]);

  useEffect(() => {
    return () => {
      cameraStream?.getTracks().forEach((track) => track.stop());
    };
  }, [cameraStream]);

  const nextBid = useMemo(() => currentBid + 20, [currentBid]);

  const handleCamera = async () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
      return;
    }

    setCameraError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera not available in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      setCameraStream(stream);
    } catch {
      setCameraError("Camera access blocked. Check browser permissions.");
    }
  };

  const handleBid = () => {
    setCurrentBid((prev) => prev + 20);
    setBidCount((prev) => prev + 1);
    setTimeLeft((prev) => {
      const base = prev < 20 ? 20 : prev;
      return base + 12;
    });
    setBids((prev) => [
      {
        id: `b${prev.length + 4}`,
        bidder: "You",
        amount: currentBid + 20,
        time: formatTime(timeLeft),
      },
      ...prev,
    ]);
  };

  const handleSend = () => {
    if (!message.trim()) return;
    setChat((prev) => [
      ...prev,
      { id: `c${prev.length + 4}`, sender: "You", text: message },
    ]);
    setMessage("");
  };

  return (
    <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-6">
        <div className="overflow-hidden rounded-[32px] border border-white/60 bg-white/80 shadow-[0_30px_90px_rgba(15,23,42,0.18)]">
          <div className="relative h-[360px] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700">
            {cameraStream ? (
              <video
                ref={primaryVideoRef}
                className="absolute inset-0 h-full w-full object-cover"
                muted
                playsInline
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-white/60">
                Camera feed ready. Enable to preview.
              </div>
            )}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(27,77,255,0.3),_transparent_60%)]" />
            <div className="absolute left-6 top-6 flex items-center gap-3">
              <span className="rounded-full bg-white/15 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white">
                Live
              </span>
              <button
                onClick={handleCamera}
                className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white transition hover:bg-white/25"
              >
                {cameraStream ? "Stop camera" : "Enable camera"}
              </button>
            </div>
            <div className="absolute right-6 top-6 rounded-full bg-white/10 px-3 py-1 text-xs text-white">
              4K / Dual Cam
            </div>
            <div className="absolute bottom-6 left-6 space-y-1 text-white">
              <p className="font-display text-2xl">Base Set Booster Box</p>
              <p className="text-sm text-white/70">
                Cobalt Labs - Chain-of-Custody Enabled
              </p>
            </div>
            <div className="absolute bottom-6 right-6 grid gap-3">
              <div className="h-20 w-32 overflow-hidden rounded-2xl border border-white/30 bg-slate-900/70">
                <video
                  ref={detailVideoRef}
                  className="h-full w-full object-cover"
                  muted
                  playsInline
                />
              </div>
              <div className="rounded-2xl border border-white/30 bg-slate-900/70 px-3 py-2 text-xs text-white/70">
                Close-up cam
              </div>
            </div>
            {cameraError && (
              <div className="absolute left-6 top-16 rounded-full bg-red-500/20 px-3 py-1 text-xs text-red-100">
                {cameraError}
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/60 px-6 py-4 text-sm text-slate-600">
            <div className="flex items-center gap-3">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
              312 watching
            </div>
            <div className="flex items-center gap-4">
              <span>Authenticated on-stream</span>
              <span>Escrow protected</span>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_240px]">
          <div className="surface-panel rounded-[28px] p-6">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
              Live price
            </p>
            <p className="font-display text-4xl text-slate-900">
              ${currentBid.toLocaleString()}
            </p>
            <p className="mt-3 text-sm text-slate-500">
              Verified buyer / +$20 increments / Reserve met
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                onClick={handleBid}
                className="rounded-full bg-[var(--royal)] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:bg-[var(--royal-deep)]"
              >
                Place offer ${nextBid.toLocaleString()}
              </button>
              <button className="rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700">
                Auto offer
              </button>
            </div>
          </div>

          <div className="glass-panel rounded-[28px] p-5 text-center">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
              Time left
            </p>
            <p className="font-display text-4xl text-[var(--royal)]">
              {formatTime(timeLeft)}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Each offer adds +12s (anti-snipe)
            </p>
            <div className="mt-4 rounded-2xl bg-white/70 px-3 py-2 text-xs text-slate-600">
              {bidCount} verified offers
            </div>
          </div>
        </div>

        <div className="surface-panel rounded-[28px] p-6">
          <h3 className="font-display text-xl text-slate-900">
            Buyer protection built in
          </h3>
          <div className="mt-4 grid gap-4 text-sm text-slate-600 md:grid-cols-3">
            <div>
              <p className="font-semibold text-slate-800">Manual vetting</p>
              <p>Seller interviews, inventory audits, and ID verification.</p>
            </div>
            <div>
              <p className="font-semibold text-slate-800">Escrow control</p>
              <p>Funds held until delivery + authenticity confirmation.</p>
            </div>
            <div>
              <p className="font-semibold text-slate-800">Claims desk</p>
              <p>Dispute resolution with on-stream recording log.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="surface-panel rounded-[28px] p-6">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg text-slate-900">Live chat</h3>
            <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Moderated
            </span>
          </div>
          <div className="mt-4 space-y-3 text-sm text-slate-600">
            {chat.map((entry) => (
              <div
                key={entry.id}
                className={`rounded-2xl px-3 py-2 ${
                  entry.sender === "You"
                    ? "ml-auto bg-[var(--royal)]/10 text-slate-800"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                <span className="block text-xs font-semibold text-slate-500">
                  {entry.sender}
                </span>
                <span>{entry.text}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-2">
            <input
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Message the room"
              className="flex-1 rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-sm text-slate-700 outline-none focus:border-[var(--royal)]"
            />
            <button
              onClick={handleSend}
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            >
              Send
            </button>
          </div>
        </div>

        <div className="surface-panel rounded-[28px] p-6">
          <div className="flex items-center justify-between">
          <h3 className="font-display text-lg text-slate-900">Offer stack</h3>
            <span className="text-xs text-slate-400">Live order</span>
          </div>
          <div className="mt-4 space-y-3 text-sm text-slate-600">
            {bids.map((bid) => (
              <div
                key={bid.id}
                className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white/80 px-4 py-3"
              >
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    {bid.bidder}
                  </p>
                  <p className="font-display text-lg text-slate-900">
                    ${bid.amount.toLocaleString()}
                  </p>
                </div>
                <span className="text-xs text-slate-400">{bid.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
