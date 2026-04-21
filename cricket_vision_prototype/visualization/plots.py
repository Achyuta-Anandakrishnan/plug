from __future__ import annotations

import cv2
import numpy as np

from cricket_vision_prototype.config import PrototypeConfig
from cricket_vision_prototype.projection.field_projection import FieldProjectionResult
from cricket_vision_prototype.projection.net_impact import NetImpactResult


def create_topdown_summary(
    projection: FieldProjectionResult,
    net_impact: NetImpactResult,
    config: PrototypeConfig,
    width: int = 900,
    height: int = 700,
) -> np.ndarray:
    canvas = np.full((height, width, 3), 24, dtype=np.uint8)

    center = (width // 2, int(height * 0.8))
    radius_px = int(min(width, height) * 0.42)

    cv2.circle(canvas, center, radius_px, (60, 90, 60), 2)
    cv2.line(canvas, center, (center[0], center[1] - radius_px), (80, 80, 180), 2)
    cv2.putText(canvas, "Straight", (center[0] + 8, center[1] - radius_px + 18), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (180, 180, 180), 1)

    if projection.projected_landing_xy_m is not None and projection.projected_distance_m is not None:
        scale = radius_px / config.field_radius_m
        lx, ly = projection.projected_landing_xy_m
        px = int(center[0] + lx * scale)
        py = int(center[1] - ly * scale)

        cv2.arrowedLine(canvas, center, (px, py), (80, 180, 255), 2, tipLength=0.04)
        cv2.circle(canvas, (px, py), 8, (0, 220, 255), -1)

        uncert_px = int(projection.uncertainty_radius_m * scale)
        cv2.circle(canvas, (px, py), max(6, uncert_px), (0, 120, 200), 1)
        cv2.putText(canvas, projection.projected_outcome_label, (px + 10, py), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (220, 220, 220), 1)

    net_x, net_y = int(width * 0.08), int(height * 0.08)
    net_w, net_h = int(width * 0.2), int(height * 0.2)
    cv2.rectangle(canvas, (net_x, net_y), (net_x + net_w, net_y + net_h), (180, 180, 180), 1)
    cv2.putText(canvas, "Normalized net impact", (net_x, net_y - 6), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (180, 180, 180), 1)

    if net_impact.impact_x_ratio is not None and net_impact.impact_y_ratio is not None:
        ix = int(net_x + net_impact.impact_x_ratio * net_w)
        iy = int(net_y + net_impact.impact_y_ratio * net_h)
        cv2.circle(canvas, (ix, iy), 6, (0, 0, 255), -1)

    cv2.putText(
        canvas,
        f"Projection confidence: {projection.confidence:.2f} (approximate)",
        (20, height - 24),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.55,
        (200, 200, 200),
        1,
    )

    return canvas
