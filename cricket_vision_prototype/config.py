from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml


@dataclass
class SmoothingConfig:
    method: str = "moving_average"
    window: int = 5
    savgol_window: int = 7
    savgol_poly_order: int = 2


@dataclass
class TrackerConfig:
    max_jump_px: float = 90.0
    max_missed_frames: int = 6
    min_detection_confidence: float = 0.2
    min_contour_area_px: float = 6.0
    max_contour_area_px: float = 220.0
    min_circularity: float = 0.35


@dataclass
class ConfidenceConfig:
    min_calibration_quality: float = 0.3
    min_track_quality: float = 0.25
    low_confidence_note_threshold: float = 0.5


@dataclass
class PrototypeConfig:
    pitch_length_m: float = 20.12
    stump_height_m: float = 0.71
    stump_width_m: float = 0.228
    crease_length_m: float = 2.64
    net_width_m: float = 3.6
    net_height_m: float = 3.0
    distance_camera_to_stumps_m: float | None = None
    frame_rate_override: float | None = None
    gravity_mps2: float = 9.81
    field_radius_m: float = 75.0
    calibration_frame_idx: int = 0
    use_roi: bool = True
    roi_padding_px: int = 20
    smoothing: SmoothingConfig = field(default_factory=SmoothingConfig)
    tracker: TrackerConfig = field(default_factory=TrackerConfig)
    confidence: ConfidenceConfig = field(default_factory=ConfidenceConfig)


DEFAULT_CONFIG = PrototypeConfig()


def load_config(path: str | Path) -> PrototypeConfig:
    raw = yaml.safe_load(Path(path).read_text())
    if raw is None:
        return DEFAULT_CONFIG

    merged: dict[str, Any] = {
        **DEFAULT_CONFIG.__dict__,
        **raw,
    }

    smoothing = SmoothingConfig(**{**DEFAULT_CONFIG.smoothing.__dict__, **raw.get("smoothing", {})})
    tracker = TrackerConfig(**{**DEFAULT_CONFIG.tracker.__dict__, **raw.get("tracker", {})})
    confidence = ConfidenceConfig(**{**DEFAULT_CONFIG.confidence.__dict__, **raw.get("confidence", {})})

    merged["smoothing"] = smoothing
    merged["tracker"] = tracker
    merged["confidence"] = confidence
    return PrototypeConfig(**merged)
