from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from cricket_vision_prototype.config import TrackerConfig
from cricket_vision_prototype.tracking.ball_detector import Detection


@dataclass
class BallState:
    frame_idx: int
    timestamp_sec: float
    x_px: float
    y_px: float
    confidence: float
    source: str


@dataclass
class TrackResult:
    raw_detections: list[Detection]
    filtered_track: list[BallState]
    dropped_frames: int
    track_confidence: float


class BallTracker:
    def __init__(self, cfg: TrackerConfig) -> None:
        self.cfg = cfg
        self.track: list[BallState] = []
        self.raw: list[Detection] = []
        self.missed = 0

    def update(self, detections: list[Detection]) -> None:
        if detections:
            self.raw.extend(detections)

        candidate = self._pick_candidate(detections)
        if candidate is None:
            self.missed += 1
            return

        self.missed = 0
        self.track.append(
            BallState(
                frame_idx=candidate.frame_idx,
                timestamp_sec=candidate.timestamp_sec,
                x_px=candidate.x_px,
                y_px=candidate.y_px,
                confidence=candidate.confidence,
                source="detector",
            )
        )

    def _pick_candidate(self, detections: list[Detection]) -> Detection | None:
        if not detections:
            return None

        filtered = [d for d in detections if d.confidence >= self.cfg.min_detection_confidence]
        if not filtered:
            return None

        if not self.track:
            return filtered[0]

        prev = self.track[-1]
        ranked: list[tuple[float, Detection]] = []
        for detection in filtered:
            dist = np.hypot(detection.x_px - prev.x_px, detection.y_px - prev.y_px)
            if dist > self.cfg.max_jump_px:
                continue
            score = detection.confidence - (dist / self.cfg.max_jump_px) * 0.5
            ranked.append((score, detection))

        if not ranked:
            return None

        ranked.sort(key=lambda item: item[0], reverse=True)
        return ranked[0][1]

    def result(self) -> TrackResult:
        dropped = max(0, self.missed)
        conf = float(np.clip(np.mean([s.confidence for s in self.track]), 0.0, 1.0)) if self.track else 0.0
        return TrackResult(raw_detections=self.raw, filtered_track=self.track, dropped_frames=dropped, track_confidence=conf)
