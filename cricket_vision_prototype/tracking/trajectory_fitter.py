from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from cricket_vision_prototype.config import PrototypeConfig
from cricket_vision_prototype.tracking.ball_tracker import BallState
from cricket_vision_prototype.utils.geometry import clamp, px_per_frame_to_kmh
from cricket_vision_prototype.utils.smoothing import smooth_series


@dataclass
class TrajectoryPoint:
    frame_idx: int
    timestamp_sec: float
    x_px: float
    y_px: float
    x_smooth_px: float
    y_smooth_px: float
    confidence: float


@dataclass
class SpeedEstimates:
    speed_pre_contact_kmh: float | None
    speed_post_contact_kmh: float | None
    speed_pre_contact_pxps: float | None
    speed_post_contact_pxps: float | None
    method_used: str
    confidence: float
    approximate: bool
    notes: list[str]


def fit_trajectory(track: list[BallState], config: PrototypeConfig) -> list[TrajectoryPoint]:
    if not track:
        return []

    xs = np.array([p.x_px for p in track], dtype=float)
    ys = np.array([p.y_px for p in track], dtype=float)

    xs_s = smooth_series(xs, config.smoothing.method, config.smoothing.window, config.smoothing.savgol_poly_order)
    ys_s = smooth_series(ys, config.smoothing.method, config.smoothing.window, config.smoothing.savgol_poly_order)

    return [
        TrajectoryPoint(
            frame_idx=p.frame_idx,
            timestamp_sec=p.timestamp_sec,
            x_px=p.x_px,
            y_px=p.y_px,
            x_smooth_px=float(xs_s[i]),
            y_smooth_px=float(ys_s[i]),
            confidence=p.confidence,
        )
        for i, p in enumerate(track)
    ]


def estimate_speeds(trajectory: list[TrajectoryPoint], fps: float, meters_per_px: float | None) -> SpeedEstimates:
    notes = ["Speed estimates are approximate due to single-camera projection and calibration uncertainty."]
    if len(trajectory) < 4 or fps <= 0:
        return SpeedEstimates(None, None, None, None, "insufficient_track", 0.1, True, [*notes, "Need >=4 trajectory points"])

    points = np.array([[p.x_smooth_px, p.y_smooth_px] for p in trajectory], dtype=float)
    deltas_px = np.linalg.norm(np.diff(points, axis=0), axis=1)
    pxps = deltas_px * fps

    mid = len(pxps) // 2
    pre_pxps = float(np.mean(pxps[: max(1, mid)]))
    post_pxps = float(np.mean(pxps[mid:]))

    pre_pxpf = pre_pxps / fps
    post_pxpf = post_pxps / fps
    pre_kmh, method_pre = px_per_frame_to_kmh(pre_pxpf, meters_per_px, fps)
    post_kmh, method_post = px_per_frame_to_kmh(post_pxpf, meters_per_px, fps)

    scale_available = method_pre == "scale_velocity" or method_post == "scale_velocity"
    method = "scale_velocity" if scale_available else "pixel_velocity"

    confidence = 0.35 + (0.3 if scale_available else 0.0)
    confidence += clamp(np.mean([p.confidence for p in trajectory]), 0.0, 1.0) * 0.25
    confidence = clamp(confidence, 0.0, 0.9)

    if not scale_available:
        notes.append("Meters-per-pixel unavailable or unstable; km/h unavailable for one or both segments")

    return SpeedEstimates(
        speed_pre_contact_kmh=pre_kmh,
        speed_post_contact_kmh=post_kmh,
        speed_pre_contact_pxps=pre_pxps,
        speed_post_contact_pxps=post_pxps,
        method_used=method,
        confidence=confidence,
        approximate=True,
        notes=notes,
    )
