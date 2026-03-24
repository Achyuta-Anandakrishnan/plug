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
    <section className="live-auction-room">
      <div className="live-auction-main">
        <div className="live-auction-stage-card">
          <div className="live-auction-stage">
            {cameraStream ? (
              <video
                ref={primaryVideoRef}
                className="live-auction-video"
                muted
                playsInline
              />
            ) : (
              <div className="live-auction-no-cam">
                Camera feed ready. Enable to preview.
              </div>
            )}
            <div className="live-auction-stage-overlay" aria-hidden="true" />
            <div className="live-auction-stage-badges">
              <span className="stream-room-badge">Live</span>
              <button
                onClick={handleCamera}
                className="stream-room-badge live-auction-cam-btn"
              >
                {cameraStream ? "Stop camera" : "Enable camera"}
              </button>
            </div>
            <div className="live-auction-stage-meta">
              <span className="stream-room-badge">4K / Dual Cam</span>
            </div>
            <div className="live-auction-stage-info">
              <p className="live-auction-stage-title">Base Set Booster Box</p>
              <p className="live-auction-stage-subtitle">
                Cobalt Labs – Chain-of-Custody Enabled
              </p>
            </div>
            <div className="live-auction-detail-cam">
              <div className="live-auction-detail-cam-feed">
                <video
                  ref={detailVideoRef}
                  className="live-auction-video"
                  muted
                  playsInline
                />
              </div>
              <div className="live-auction-detail-cam-label">Close-up cam</div>
            </div>
            {cameraError ? (
              <div className="live-auction-cam-error">{cameraError}</div>
            ) : null}
          </div>
          <div className="live-auction-stage-footer">
            <div className="live-auction-viewers">
              <span className="live-auction-viewers-dot" aria-hidden="true" />
              312 watching
            </div>
            <div className="live-auction-trust-badges">
              <span>Authenticated on-stream</span>
              <span>Escrow protected</span>
            </div>
          </div>
        </div>

        <div className="live-auction-controls">
          <div className="live-auction-price-panel">
            <p className="app-eyebrow">Live price</p>
            <p className="live-auction-price">${currentBid.toLocaleString()}</p>
            <p className="live-auction-price-note">
              Verified buyer · +$20 increments · Reserve met
            </p>
            <div className="live-auction-actions">
              <button
                onClick={handleBid}
                className="app-button app-button-primary"
              >
                Place offer ${nextBid.toLocaleString()}
              </button>
              <button
                type="button"
                disabled
                title="Auto offer is not yet available"
                className="app-button app-button-secondary"
              >
                Auto offer
              </button>
            </div>
          </div>

          <div className="live-auction-timer-panel">
            <p className="app-eyebrow">Time left</p>
            <p className="live-auction-timer">{formatTime(timeLeft)}</p>
            <p className="live-auction-timer-note">Each offer adds +12s (anti-snipe)</p>
            <div className="live-auction-bid-count">{bidCount} verified offers</div>
          </div>
        </div>

        <div className="live-auction-protection-panel">
          <h3 className="live-auction-section-title">Buyer protection built in</h3>
          <div className="live-auction-protection-grid">
            <div>
              <p className="live-auction-protection-item-title">Manual vetting</p>
              <p className="live-auction-protection-item-body">Seller interviews, inventory audits, and ID verification.</p>
            </div>
            <div>
              <p className="live-auction-protection-item-title">Escrow control</p>
              <p className="live-auction-protection-item-body">Funds held until delivery + authenticity confirmation.</p>
            </div>
            <div>
              <p className="live-auction-protection-item-title">Claims desk</p>
              <p className="live-auction-protection-item-body">Dispute resolution with on-stream recording log.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="live-auction-sidebar">
        <div className="live-auction-chat-panel">
          <div className="live-auction-panel-head">
            <h3 className="live-auction-section-title">Live chat</h3>
            <span className="app-eyebrow">Moderated</span>
          </div>
          <div className="live-auction-chat-feed">
            {chat.map((entry) => (
              <div
                key={entry.id}
                className={`live-auction-chat-bubble${entry.sender === "You" ? " is-mine" : ""}`}
              >
                <span className="live-auction-chat-sender">{entry.sender}</span>
                <span>{entry.text}</span>
              </div>
            ))}
          </div>
          <div className="live-auction-chat-compose">
            <input
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Message the room"
              className="app-form-input live-auction-chat-input"
            />
            <button
              onClick={handleSend}
              className="app-button app-button-primary"
            >
              Send
            </button>
          </div>
        </div>

        <div className="live-auction-bids-panel">
          <div className="live-auction-panel-head">
            <h3 className="live-auction-section-title">Offer stack</h3>
            <span className="app-eyebrow">Live order</span>
          </div>
          <div className="live-auction-bid-feed">
            {bids.map((bid) => (
              <div key={bid.id} className="live-auction-bid-row">
                <div>
                  <p className="app-eyebrow">{bid.bidder}</p>
                  <p className="live-auction-bid-amount">${bid.amount.toLocaleString()}</p>
                </div>
                <span className="live-auction-bid-time">{bid.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
