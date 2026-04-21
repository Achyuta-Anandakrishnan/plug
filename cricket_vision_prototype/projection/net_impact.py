from __future__ import annotations

from dataclasses import dataclass

import cv2
import numpy as np

from cricket_vision_prototype.utils.geometry import clamp


@dataclass
class NetImpactResult:
    impact_x_ratio: float | None
    impact_y_ratio: float | None
    impact_point_px: tuple[float, float] | None
    impact_point_net_plane: tuple[float, float] | None
    confidence: float
    approximate: bool
    notes: list[str]


def _order_quad(points: np.ndarray) -> np.ndarray:
    pts = points.astype(np.float32)
    sums = pts.sum(axis=1)
    diffs = np.diff(pts, axis=1).reshape(-1)

    top_left = pts[np.argmin(sums)]
    bottom_right = pts[np.argmax(sums)]
    top_right = pts[np.argmin(diffs)]
    bottom_left = pts[np.argmax(diffs)]
    return np.array([top_left, top_right, bottom_left, bottom_right], dtype=np.float32)


def estimate_net_impact(
    trajectory_points: list[tuple[float, float]],
    net_corners_px: list[tuple[float, float]],
) -> NetImpactResult:
    notes: list[str] = ["Net impact is approximate and depends on manual corner placement."]
    if not trajectory_points:
        return NetImpactResult(None, None, None, None, 0.0, True, ["No trajectory points", *notes])

    impact = trajectory_points[-1]

    if len(net_corners_px) < 4:
        notes.append("Need 4 net corners for normalized impact ratios")
        return NetImpactResult(None, None, impact, None, 0.3, True, notes)

    ordered = _order_quad(np.array(net_corners_px[:4], dtype=np.float32))
    target = np.array([[0, 0], [1, 0], [0, 1], [1, 1]], dtype=np.float32)

    matrix, _ = cv2.findHomography(ordered, target)
    if matrix is None:
        return NetImpactResult(None, None, impact, None, 0.25, True, ["Homography for net plane failed", *notes])

    transformed = cv2.perspectiveTransform(np.array([[impact]], dtype=np.float32), matrix)[0][0]
    x_ratio = clamp(float(transformed[0]), 0.0, 1.0)
    y_ratio = clamp(float(transformed[1]), 0.0, 1.0)

    confidence = 0.72
    if not (0 <= transformed[0] <= 1 and 0 <= transformed[1] <= 1):
        confidence = 0.48
        notes.append("Impact projected outside calibrated net bounds; clamped to [0, 1]")

    return NetImpactResult(
        impact_x_ratio=x_ratio,
        impact_y_ratio=y_ratio,
        impact_point_px=impact,
        impact_point_net_plane=(x_ratio, y_ratio),
        confidence=confidence,
        approximate=True,
        notes=notes,
    )
