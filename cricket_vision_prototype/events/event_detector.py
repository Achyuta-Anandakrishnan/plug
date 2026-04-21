from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from cricket_vision_prototype.tracking.trajectory_fitter import TrajectoryPoint
from cricket_vision_prototype.utils.geometry import clamp


@dataclass
class DetectedEvent:
    event_type: str
    frame_idx: int
    timestamp_sec: float
    confidence: float
    evidence: dict[str, float | str]
    approximate: bool = True


def _curvature_cosines(trajectory: list[TrajectoryPoint]) -> np.ndarray:
    points = np.array([[p.x_smooth_px, p.y_smooth_px] for p in trajectory], dtype=float)
    vectors = np.diff(points, axis=0)
    norms = np.linalg.norm(vectors, axis=1)
    valid = norms > 1e-6
    if valid.sum() < 2:
        return np.array([])
    unit = vectors[valid] / norms[valid][:, None]
    return np.sum(unit[:-1] * unit[1:], axis=1)


def _bbox_from_net(net_corners_px: list[tuple[float, float]]) -> tuple[float, float, float, float] | None:
    if len(net_corners_px) < 4:
        return None
    xs = [p[0] for p in net_corners_px[:4]]
    ys = [p[1] for p in net_corners_px[:4]]
    return min(xs), min(ys), max(xs), max(ys)


def detect_events(trajectory: list[TrajectoryPoint], net_corners_px: list[tuple[float, float]]) -> list[DetectedEvent]:
    events: list[DetectedEvent] = []
    if len(trajectory) < 3:
        return events

    events.append(
        DetectedEvent(
            event_type="release",
            frame_idx=trajectory[0].frame_idx,
            timestamp_sec=trajectory[0].timestamp_sec,
            confidence=0.45,
            evidence={"reason": "track_start"},
        )
    )

    # Bounce heuristic: strong inflection in vertical velocity.
    y_vals = np.array([p.y_smooth_px for p in trajectory], dtype=float)
    dy = np.diff(y_vals)
    if len(dy) >= 3:
        ddy = np.diff(dy)
        bounce_idx = int(np.argmax(np.abs(ddy)))
        if abs(ddy[bounce_idx]) > 1.2:
            point = trajectory[min(bounce_idx + 1, len(trajectory) - 1)]
            confidence = clamp(min(1.0, abs(ddy[bounce_idx]) / 6.0), 0.25, 0.8)
            events.append(
                DetectedEvent(
                    event_type="bounce_candidate",
                    frame_idx=point.frame_idx,
                    timestamp_sec=point.timestamp_sec,
                    confidence=confidence,
                    evidence={"dy_before": float(dy[bounce_idx]), "dy_after": float(dy[bounce_idx + 1])},
                )
            )

    # Probable contact heuristic: largest direction-change point.
    turn = _curvature_cosines(trajectory)
    if turn.size:
        idx = int(np.argmin(turn))
        if turn[idx] < 0.75:
            pivot = trajectory[min(idx + 1, len(trajectory) - 1)]
            confidence = clamp(1.0 - float(turn[idx]), 0.35, 0.85)
            events.append(
                DetectedEvent(
                    event_type="probable_contact",
                    frame_idx=pivot.frame_idx,
                    timestamp_sec=pivot.timestamp_sec,
                    confidence=confidence,
                    evidence={"turn_cosine": float(turn[idx])},
                )
            )

    # Net hit heuristic: track end near net-plane bounding region.
    net_bbox = _bbox_from_net(net_corners_px)
    if net_bbox is not None:
        min_x, min_y, max_x, max_y = net_bbox
        last = trajectory[-1]
        inside = min_x <= last.x_smooth_px <= max_x and min_y <= last.y_smooth_px <= max_y
        margin = 30.0
        near = (min_x - margin) <= last.x_smooth_px <= (max_x + margin) and (min_y - margin) <= last.y_smooth_px <= (max_y + margin)
        if inside or near:
            confidence = 0.7 if inside else 0.45
            events.append(
                DetectedEvent(
                    event_type="net_hit_candidate",
                    frame_idx=last.frame_idx,
                    timestamp_sec=last.timestamp_sec,
                    confidence=confidence,
                    evidence={"inside_net_bbox": "yes" if inside else "nearby"},
                )
            )

    events.append(
        DetectedEvent(
            event_type="track_terminal",
            frame_idx=trajectory[-1].frame_idx,
            timestamp_sec=trajectory[-1].timestamp_sec,
            confidence=0.5,
            evidence={"reason": "end_of_observation"},
        )
    )

    return sorted(events, key=lambda e: e.frame_idx)
