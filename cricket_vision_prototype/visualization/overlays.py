from __future__ import annotations

import cv2
import numpy as np

from cricket_vision_prototype.events.event_detector import DetectedEvent
from cricket_vision_prototype.projection.net_impact import NetImpactResult
from cricket_vision_prototype.tracking.trajectory_fitter import TrajectoryPoint


def draw_overlays(
    frame: np.ndarray,
    trajectory: list[TrajectoryPoint],
    events: list[DetectedEvent],
    net_corners: list[tuple[float, float]],
    net_impact: NetImpactResult,
    speed_label: str,
    confidence: float,
) -> np.ndarray:
    out = frame.copy()

    for point in trajectory:
        cv2.circle(out, (int(point.x_smooth_px), int(point.y_smooth_px)), 3, (0, 255, 255), -1)

    for i in range(1, len(trajectory)):
        p0 = trajectory[i - 1]
        p1 = trajectory[i]
        cv2.line(out, (int(p0.x_smooth_px), int(p0.y_smooth_px)), (int(p1.x_smooth_px), int(p1.y_smooth_px)), (255, 180, 0), 1)

    for corner in net_corners:
        cv2.circle(out, (int(corner[0]), int(corner[1])), 5, (255, 255, 0), -1)

    for event in events:
        matching = next((p for p in trajectory if p.frame_idx == event.frame_idx), None)
        if matching is None:
            continue
        color = (0, 255, 0) if "net" in event.event_type else (0, 180, 255)
        cv2.circle(out, (int(matching.x_smooth_px), int(matching.y_smooth_px)), 7, color, 2)
        cv2.putText(out, event.event_type, (int(matching.x_smooth_px) + 5, int(matching.y_smooth_px) - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.4, color, 1)

    if net_impact.impact_point_px is not None:
        x, y = net_impact.impact_point_px
        cv2.circle(out, (int(x), int(y)), 8, (0, 0, 255), -1)

    cv2.putText(out, speed_label, (16, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (255, 255, 255), 2)
    cv2.putText(out, f"confidence={confidence:.2f}", (16, 55), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (255, 255, 255), 2)
    return out
