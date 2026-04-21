from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from cricket_vision_prototype.config import PrototypeConfig
from cricket_vision_prototype.projection.net_impact import NetImpactResult
from cricket_vision_prototype.utils.geometry import angle_deg, clamp


@dataclass
class FieldProjectionResult:
    projected_angle_deg: float | None
    projected_distance_m: float | None
    projected_landing_xy_m: tuple[float, float] | None
    projected_outcome_label: str
    uncertainty_radius_m: float
    confidence: float
    approximate: bool
    notes: list[str]


def classify_outcome(distance_m: float | None) -> str:
    if distance_m is None:
        return "uncertain"
    if distance_m < 12:
        return "likely_dot"
    if distance_m < 30:
        return "likely_single"
    if distance_m < 45:
        return "likely_two"
    if distance_m < 65:
        return "likely_four"
    return "likely_six"


def project_landing_zone(
    contact_point_px: tuple[float, float] | None,
    net_impact: NetImpactResult,
    post_contact_speed_kmh: float | None,
    observed_contact_to_net_time_s: float | None,
    config: PrototypeConfig,
    calibration_quality: float,
    track_quality: float,
) -> FieldProjectionResult:
    notes: list[str] = [
        "Landing projection is approximate and should be interpreted as a probable zone, not exact carry distance.",
    ]
    if contact_point_px is None or net_impact.impact_point_px is None:
        return FieldProjectionResult(None, None, None, "uncertain", 40.0, 0.2, True, [*notes, "Missing contact or impact point"])

    angle = angle_deg(contact_point_px, net_impact.impact_point_px)

    if post_contact_speed_kmh is None:
        distance = 24.0
        notes.append("Post-contact speed unavailable; used conservative default distance model")
    else:
        speed_mps = post_contact_speed_kmh / 3.6
        flight_time = observed_contact_to_net_time_s or 0.18
        distance = speed_mps * (flight_time + 0.8)

    distance = clamp(distance, 6.0, config.field_radius_m)
    angle_rad = np.radians(angle)
    landing = (float(distance * np.cos(angle_rad)), float(distance * np.sin(angle_rad)))

    confidence = (
        clamp(calibration_quality, 0.0, 1.0) * 0.35
        + clamp(track_quality, 0.0, 1.0) * 0.35
        + clamp(net_impact.confidence, 0.0, 1.0) * 0.2
        + 0.1
    )
    confidence = float(clamp(confidence, 0.0, 0.92))
    uncertainty = float(7.0 + (1.0 - confidence) * 26.0)

    return FieldProjectionResult(
        projected_angle_deg=angle,
        projected_distance_m=distance,
        projected_landing_xy_m=landing,
        projected_outcome_label=classify_outcome(distance),
        uncertainty_radius_m=uncertainty,
        confidence=confidence,
        approximate=True,
        notes=notes,
    )
