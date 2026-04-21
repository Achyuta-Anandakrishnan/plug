"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type MotionPoint = {
  ts: number;
  x: number;
  y: number;
  strength: number;
};

type EventCandidate = {
  type: "release_candidate" | "contact_candidate" | "net_hit_candidate";
  ts: number;
  confidence: number;
  note: string;
};

const CANVAS_W = 480;
const CANVAS_H = 270;

export function LiveCamTester() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const processCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const processFrameRef = useRef<(() => void) | null>(null);
  const prevFrameRef = useRef<Uint8ClampedArray | null>(null);
  const pointsRef = useRef<MotionPoint[]>([]);
  const eventsRef = useRef<EventCandidate[]>([]);

  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("Idle");
  const [lastSpeedPx, setLastSpeedPx] = useState<number | null>(null);
  const [lastConfidence, setLastConfidence] = useState(0);
  const [pointCount, setPointCount] = useState(0);
  const [eventCount, setEventCount] = useState(0);
  const [averageSpeed, setAverageSpeed] = useState<number | null>(null);

  const stopCamera = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    prevFrameRef.current = null;
    setRunning(false);
    setStatus("Stopped");
  }, []);

  const detectEventCandidates = useCallback((points: MotionPoint[]) => {
    if (points.length < 12) return;

    const latest = points[points.length - 1];
    const early = points[points.length - 12];
    const dx = latest.x - early.x;
    const dy = latest.y - early.y;
    const directionChange = Math.abs(Math.atan2(dy, dx));

    if (points.length === 12) {
      eventsRef.current.push({
        type: "release_candidate",
        ts: early.ts,
        confidence: 0.45,
        note: "Track start in motion corridor (approximate)",
      });
    }

    if (directionChange > 1.2) {
      eventsRef.current.push({
        type: "contact_candidate",
        ts: latest.ts,
        confidence: Math.min(0.8, 0.35 + directionChange / 3),
        note: "High direction-change pivot (approximate)",
      });
    }

    if (latest.y < CANVAS_H * 0.42 && latest.x > CANVAS_W * 0.2 && latest.x < CANVAS_W * 0.8) {
      eventsRef.current.push({
        type: "net_hit_candidate",
        ts: latest.ts,
        confidence: 0.55,
        note: "Track entered likely net-zone region (approximate)",
      });
    }

    if (eventsRef.current.length > 30) {
      eventsRef.current = eventsRef.current.slice(-30);
    }
    setEventCount(eventsRef.current.length);
  }, []);

  const renderOverlay = useCallback(() => {
    const canvas = drawCanvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "rgba(0,255,255,0.9)";
    ctx.lineWidth = 2;
    const trail = pointsRef.current.slice(-30);
    for (let i = 1; i < trail.length; i += 1) {
      const a = trail[i - 1];
      const b = trail[i];
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    const last = trail[trail.length - 1];
    if (last) {
      ctx.fillStyle = "rgba(255,80,80,0.95)";
      ctx.beginPath();
      ctx.arc(last.x, last.y, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(10, 10, 250, 72);
    ctx.fillStyle = "white";
    ctx.font = "12px system-ui";
    ctx.fillText("Live prototype (approximate only)", 18, 28);
    ctx.fillText(`Points: ${pointsRef.current.length}`, 18, 45);
    ctx.fillText(`Events: ${eventsRef.current.length}`, 18, 62);
  }, []);

  const processFrame = useCallback(() => {
    const video = videoRef.current;
    const processCanvas = processCanvasRef.current;
    if (!video || !processCanvas || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(() => processFrameRef.current?.());
      return;
    }

    const ctx = processCanvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      rafRef.current = requestAnimationFrame(() => processFrameRef.current?.());
      return;
    }

    ctx.drawImage(video, 0, 0, processCanvas.width, processCanvas.height);
    const image = ctx.getImageData(0, 0, processCanvas.width, processCanvas.height);
    const data = image.data;

    const gray = new Uint8ClampedArray(processCanvas.width * processCanvas.height);
    for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
      gray[p] = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) | 0;
    }

    const prev = prevFrameRef.current;
    if (prev) {
      let motionPixels = 0;
      let sumX = 0;
      let sumY = 0;
      const threshold = 26;

      for (let y = 0; y < processCanvas.height; y += 1) {
        for (let x = 0; x < processCanvas.width; x += 1) {
          const idx = y * processCanvas.width + x;
          const diff = Math.abs(gray[idx] - prev[idx]);
          if (diff > threshold) {
            motionPixels += 1;
            sumX += x;
            sumY += y;
          }
        }
      }

      if (motionPixels > 40 && motionPixels < 7000) {
        const scaleX = CANVAS_W / processCanvas.width;
        const scaleY = CANVAS_H / processCanvas.height;
        const cx = (sumX / motionPixels) * scaleX;
        const cy = (sumY / motionPixels) * scaleY;
        const strength = Math.min(1, motionPixels / 1300);

        const ts = Date.now();
        const point: MotionPoint = { ts, x: cx, y: cy, strength };
        const points = [...pointsRef.current, point].slice(-160);
        pointsRef.current = points;

        if (points.length > 1) {
          const prevPoint = points[points.length - 2];
          const dt = (point.ts - prevPoint.ts) / 1000;
          if (dt > 0) {
            const speed = Math.hypot(point.x - prevPoint.x, point.y - prevPoint.y) / dt;
            setLastSpeedPx(speed);
          }
        }

        setLastConfidence(Math.min(0.9, 0.2 + strength * 0.7));
        setPointCount(points.length);

        const recent = points.slice(-18);
        const speeds: number[] = [];
        for (let i = 1; i < recent.length; i += 1) {
          const prevPoint = recent[i - 1];
          const currPoint = recent[i];
          const dt = (currPoint.ts - prevPoint.ts) / 1000;
          if (dt <= 0) continue;
          speeds.push(Math.hypot(currPoint.x - prevPoint.x, currPoint.y - prevPoint.y) / dt);
        }
        setAverageSpeed(speeds.length ? speeds.reduce((a, b) => a + b, 0) / speeds.length : null);

        detectEventCandidates(points);
      }
    }

    prevFrameRef.current = gray;
    renderOverlay();
    rafRef.current = requestAnimationFrame(() => processFrameRef.current?.());
  }, [detectEventCandidates, renderOverlay]);

  useEffect(() => {
    processFrameRef.current = processFrame;
  }, [processFrame]);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      streamRef.current = stream;
      pointsRef.current = [];
      eventsRef.current = [];
      setPointCount(0);
      setEventCount(0);
      setStatus("Running (approximate CV test)");
      setRunning(true);

      rafRef.current = requestAnimationFrame(() => processFrameRef.current?.());
    } catch (error) {
      setStatus(`Camera error: ${(error as Error).message}`);
    }
  }, []);

  const exportSession = useCallback(() => {
    const payload = {
      generated_at: new Date().toISOString(),
      approximate_output: true,
      notes: [
        "This browser prototype is heuristic and approximate.",
        "Single-camera view cannot recover exact 3D trajectory.",
      ],
      points: pointsRef.current,
      events: eventsRef.current,
      stats: {
        avg_speed_pxps: averageSpeed,
        latest_speed_pxps: lastSpeedPx,
        last_confidence: lastConfidence,
      },
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cricket-live-session-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [averageSpeed, lastConfidence, lastSpeedPx]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#1f7fd433,#070b19_45%,#04060f)] p-6 text-white">
      <div className="mx-auto max-w-6xl space-y-5">
        <section className="rounded-3xl border border-white/20 bg-white/10 p-5 backdrop-blur-2xl">
          <h1 className="text-2xl font-semibold">iPhone Live Cam Tester (Web Prototype)</h1>
          <p className="mt-1 text-sm text-white/80">
            Use this page from Safari on iPhone to test live motion-based ball tracking heuristics. Outputs are approximate.
          </p>
          <p className="mt-2 text-xs text-amber-200">
            Tip: host over HTTPS (or local network dev tunnel) so iPhone camera permissions work.
          </p>
        </section>

        <section className="grid gap-5 lg:grid-cols-[1.3fr,1fr]">
          <div className="rounded-3xl border border-white/20 bg-white/10 p-4 backdrop-blur-2xl">
            <div className="relative overflow-hidden rounded-2xl bg-black">
              <video ref={videoRef} playsInline muted className="hidden" />
              <canvas ref={drawCanvasRef} width={CANVAS_W} height={CANVAS_H} className="h-auto w-full" />
              <canvas ref={processCanvasRef} width={160} height={90} className="hidden" />
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={startCamera}
                disabled={running}
                className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
              >
                Start Camera
              </button>
              <button
                onClick={stopCamera}
                disabled={!running}
                className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm disabled:opacity-50"
              >
                Stop
              </button>
              <button
                onClick={exportSession}
                className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm"
              >
                Export JSON
              </button>
            </div>
          </div>

          <aside className="space-y-3 rounded-3xl border border-white/20 bg-white/10 p-5 backdrop-blur-2xl">
            <h2 className="text-lg font-medium">Session Stats</h2>
            <Stat label="Status" value={status} />
            <Stat label="Motion points" value={String(pointCount)} />
            <Stat label="Event candidates" value={String(eventCount)} />
            <Stat label="Latest speed (px/s)" value={lastSpeedPx ? lastSpeedPx.toFixed(1) : "-"} />
            <Stat label="Avg speed (px/s)" value={averageSpeed ? averageSpeed.toFixed(1) : "-"} />
            <Stat label="Confidence" value={lastConfidence.toFixed(2)} />

            <div className="rounded-xl border border-amber-200/30 bg-amber-300/10 p-3 text-xs text-amber-100">
              Approximate-only output. Single iPhone camera + browser motion heuristics are for practice feedback, not umpiring.
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm">
      <p className="text-xs uppercase tracking-[0.2em] text-white/60">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}
