"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  Room,
  RoomEvent,
  Track,
  createLocalTracks,
  LocalVideoTrack,
  LocalAudioTrack,
} from "livekit-client";

type LiveKitStreamProps = {
  auctionId: string;
  isHost?: boolean;
  fallbackImageUrl?: string | null;
  fallbackVideoUrl?: string | null;
  className?: string;
  onParticipantCount?: (count: number) => void;
  onStatusChange?: (status: StreamStatus) => void;
};

type StreamStatus = "idle" | "connecting" | "live" | "error";

export function LiveKitStream({
  auctionId,
  isHost = false,
  fallbackImageUrl,
  fallbackVideoUrl,
  className,
  onParticipantCount,
  onStatusChange,
}: LiveKitStreamProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [remoteVideoTrack, setRemoteVideoTrack] = useState<Track | null>(null);
  const [localVideoTrack, setLocalVideoTrack] = useState<LocalVideoTrack | null>(
    null,
  );
  const [localAudioTrack, setLocalAudioTrack] = useState<LocalAudioTrack | null>(
    null,
  );
  const [status, setStatus] = useState<StreamStatus>("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    onStatusChange?.(status);
  }, [onStatusChange, status]);

  useEffect(() => {
    const element = videoRef.current;
    if (!element) return;
    const track = remoteVideoTrack ?? localVideoTrack;
    if (!track) {
      element.srcObject = null;
      return;
    }
    track.attach(element);
    return () => {
      track.detach(element);
    };
  }, [localVideoTrack, remoteVideoTrack]);

  useEffect(() => {
    if (isHost) return;
    let activeRoom: Room | null = null;
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const connectViewer = async () => {
      setError("");
      setStatus("connecting");
      try {
        const response = await fetch("/api/streams/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ auctionId, role: "viewer" }),
        });
        const payload = await response.json();
        if (!response.ok) {
          if (response.status === 409) {
            setStatus("idle");
            retryTimer = setTimeout(connectViewer, 5000);
            return;
          }
          setError(payload.error || "Unable to join stream.");
          setStatus("error");
          return;
        }

        const roomInstance = new Room({
          adaptiveStream: true,
          dynacast: true,
        });
        activeRoom = roomInstance;

        const updateCount = () => {
          onParticipantCount?.(roomInstance.remoteParticipants.size);
        };

        roomInstance.on(RoomEvent.ParticipantConnected, updateCount);
        roomInstance.on(RoomEvent.ParticipantDisconnected, updateCount);
        roomInstance.on(RoomEvent.TrackSubscribed, (track) => {
          if (track.kind === Track.Kind.Video) {
            setRemoteVideoTrack(track);
          }
        });
        roomInstance.on(RoomEvent.TrackUnsubscribed, (track) => {
          if (track.kind === Track.Kind.Video) {
            setRemoteVideoTrack(null);
          }
        });
        roomInstance.on(RoomEvent.Disconnected, () => {
          setStatus("idle");
          setRemoteVideoTrack(null);
        });

        await roomInstance.connect(payload.url, payload.token);
        if (cancelled) return;
        setRoom(roomInstance);
        updateCount();
        setStatus("live");
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Unable to join stream.",
        );
        setStatus("error");
      }
    };

    connectViewer();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (activeRoom) {
        activeRoom.disconnect();
      }
    };
  }, [auctionId, isHost, onParticipantCount]);

  const startBroadcast = async () => {
    if (room) return;
    setError("");
    setStatus("connecting");
    try {
      const sessionResponse = await fetch("/api/streams/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auctionId }),
      });
      const sessionPayload = await sessionResponse.json();
      if (!sessionResponse.ok) {
        setError(sessionPayload.error || "Unable to start stream.");
        setStatus("error");
        return;
      }

      const response = await fetch("/api/streams/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auctionId, role: "host" }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error || "Unable to start stream.");
        setStatus("error");
        return;
      }

      const roomInstance = new Room({
        adaptiveStream: true,
        dynacast: true,
      });
      setRoom(roomInstance);
      const updateCount = () => {
        onParticipantCount?.(roomInstance.remoteParticipants.size);
      };
      roomInstance.on(RoomEvent.ParticipantConnected, updateCount);
      roomInstance.on(RoomEvent.ParticipantDisconnected, updateCount);
      roomInstance.on(RoomEvent.Disconnected, () => {
        setStatus("idle");
        setLocalVideoTrack(null);
        setLocalAudioTrack(null);
      });

      await roomInstance.connect(payload.url, payload.token);
      updateCount();

      const tracks = await createLocalTracks({
        audio: true,
        video: { facingMode: "user" },
      });
      const localVideo = tracks.find(
        (track) => track.kind === Track.Kind.Video,
      ) as LocalVideoTrack | undefined;
      const localAudio = tracks.find(
        (track) => track.kind === Track.Kind.Audio,
      ) as LocalAudioTrack | undefined;

      if (localVideo) {
        await roomInstance.localParticipant.publishTrack(localVideo);
        setLocalVideoTrack(localVideo);
      }
      if (localAudio) {
        await roomInstance.localParticipant.publishTrack(localAudio);
        setLocalAudioTrack(localAudio);
      }

      setStatus("live");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to start stream.",
      );
      setStatus("error");
    }
  };

  const stopBroadcast = async () => {
    if (localVideoTrack) {
      localVideoTrack.stop();
      localVideoTrack.detach();
    }
    if (localAudioTrack) {
      localAudioTrack.stop();
    }
    if (room) {
      room.disconnect();
    }
    setRoom(null);
    setLocalVideoTrack(null);
    setLocalAudioTrack(null);
    setRemoteVideoTrack(null);
    setStatus("idle");
    await fetch("/api/streams/session", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ auctionId, status: "ENDED" }),
    }).catch(() => undefined);
  };

  const showFallback =
    status !== "live" && !remoteVideoTrack && !localVideoTrack;

  return (
    <div className={`relative h-full w-full ${className ?? ""}`}>
      {showFallback && fallbackVideoUrl ? (
        <video
          src={fallbackVideoUrl}
          className="absolute inset-0 h-full w-full object-cover"
          controls
          playsInline
        />
      ) : (
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          muted={isHost}
          playsInline
        />
      )}

      {showFallback && !fallbackVideoUrl && fallbackImageUrl && (
        <Image
          src={fallbackImageUrl}
          alt="Stream preview"
          fill
          sizes="100vw"
          className="object-cover"
          unoptimized
        />
      )}

      {showFallback && !fallbackVideoUrl && !fallbackImageUrl && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-white/70">
          Awaiting live broadcast
        </div>
      )}

      {isHost && (
        <div className="absolute right-4 top-14 z-40 flex flex-wrap items-center justify-end gap-2 md:top-16">
          <span className="rounded-full bg-white/15 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white">
            {status === "live" ? "Live" : "Offline"}
          </span>
          <button
            onClick={status === "live" ? stopBroadcast : startBroadcast}
            className="rounded-full bg-[var(--royal)] px-3 py-1 text-xs font-semibold text-white transition hover:bg-[var(--royal-deep)]"
          >
            {status === "live" ? "Stop stream" : "Go live"}
          </button>
        </div>
      )}

      {status === "connecting" && (
        <div className="absolute bottom-4 left-4 rounded-full bg-white/15 px-3 py-1 text-xs text-white/70">
          Connecting...
        </div>
      )}

      {error && (
        <div className="absolute bottom-4 left-4 rounded-full bg-red-500/20 px-3 py-1 text-xs text-red-100">
          {error}
        </div>
      )}
    </div>
  );
}
