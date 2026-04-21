from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

import numpy as np


@dataclass
class Point2D:
    x: float
    y: float


def to_np(point: Point2D | tuple[float, float]) -> np.ndarray:
    if isinstance(point, Point2D):
        return np.array([point.x, point.y], dtype=float)
    return np.array([point[0], point[1]], dtype=float)


def euclidean_distance(a: Point2D | tuple[float, float], b: Point2D | tuple[float, float]) -> float:
    av = to_np(a)
    bv = to_np(b)
    return float(np.linalg.norm(av - bv))


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def angle_deg(origin: tuple[float, float], target: tuple[float, float]) -> float:
    dx = target[0] - origin[0]
    dy = target[1] - origin[1]
    return float(np.degrees(np.arctan2(dy, dx)))


def running_confidence(values: Iterable[float]) -> float:
    arr = np.array(list(values), dtype=float)
    if arr.size == 0:
        return 0.0
    return float(np.clip(arr.mean(), 0.0, 1.0))


def px_per_frame_to_kmh(px_per_frame: float, meters_per_px: float | None, fps: float) -> tuple[float | None, str]:
    if meters_per_px is None or meters_per_px <= 0 or fps <= 0:
        return None, "insufficient_scale"

    mps = px_per_frame * meters_per_px * fps
    kmh = mps * 3.6
    if kmh < 1 or kmh > 220:
        return None, "out_of_bounds"
    return float(kmh), "scale_velocity"
