from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from pathlib import Path

import cv2
import numpy as np

from cricket_vision_prototype.calibration.homography import HomographyResult, solve_homography
from cricket_vision_prototype.config import PrototypeConfig
from cricket_vision_prototype.utils.geometry import euclidean_distance


@dataclass
class SceneCalibration:
    image_points: dict[str, tuple[float, float]]
    ground_homography: HomographyResult
    meters_per_px_ground: float | None
    net_corners_px: list[tuple[float, float]] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)

    @property
    def quality(self) -> float:
        base = self.ground_homography.quality
        if self.meters_per_px_ground is None:
            base *= 0.75
        if len(self.net_corners_px) < 4:
            base *= 0.8
        return float(np.clip(base, 0.0, 1.0))


def default_world_points(config: PrototypeConfig) -> dict[str, tuple[float, float]]:
    return {
        "left_stump_base": (-config.stump_width_m / 2.0, 0.0),
        "right_stump_base": (config.stump_width_m / 2.0, 0.0),
        "crease_left": (-config.crease_length_m / 2.0, 0.0),
        "crease_right": (config.crease_length_m / 2.0, 0.0),
    }


def collect_manual_points(frame: np.ndarray, labels: list[str]) -> dict[str, tuple[float, float]]:
    clicks: dict[str, tuple[float, float]] = {}
    frame_copy = frame.copy()
    idx = {"value": 0}

    def on_mouse(event: int, x: int, y: int, *_: int) -> None:
        if event != cv2.EVENT_LBUTTONDOWN:
            return
        if idx["value"] >= len(labels):
            return
        label = labels[idx["value"]]
        clicks[label] = (float(x), float(y))
        idx["value"] += 1

    window_name = "Calibration - click prompted points"
    cv2.namedWindow(window_name, cv2.WINDOW_NORMAL)
    cv2.setMouseCallback(window_name, on_mouse)

    while True:
        view = frame_copy.copy()
        for label, point in clicks.items():
            cv2.circle(view, (int(point[0]), int(point[1])), 4, (0, 255, 255), -1)
            cv2.putText(view, label, (int(point[0]) + 4, int(point[1]) - 4), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 255, 255), 1)

        prompt = "Done" if idx["value"] >= len(labels) else f"Click: {labels[idx['value']]}"
        cv2.putText(view, prompt, (20, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (100, 255, 100), 2)
        cv2.imshow(window_name, view)
        key = cv2.waitKey(20) & 0xFF
        if key == 13 and idx["value"] >= len(labels):
            break
        if key == 27:
            break

    cv2.destroyWindow(window_name)
    return clicks


def build_scene_calibration(frame: np.ndarray, config: PrototypeConfig, interactive: bool, points_path: str | None = None) -> SceneCalibration:
    required = ["left_stump_base", "right_stump_base", "crease_left", "crease_right"]
    optional = ["net_top_left", "net_top_right", "net_bottom_left", "net_bottom_right"]

    if points_path and Path(points_path).exists():
        source = json.loads(Path(points_path).read_text())
        image_points = {k: tuple(v) for k, v in source.items()}
    elif interactive:
        image_points = collect_manual_points(frame, required + optional)
    else:
        raise ValueError("No calibration points provided. Use --interactive-calibration or --points-json")

    world = default_world_points(config)
    src = np.array([image_points[k] for k in required], dtype=np.float32)
    dst = np.array([world[k] for k in required], dtype=np.float32)

    homography = solve_homography(src, dst)
    meters_per_px = None
    notes: list[str] = []

    if "left_stump_base" in image_points and "right_stump_base" in image_points:
        px_dist = euclidean_distance(image_points["left_stump_base"], image_points["right_stump_base"])
        if px_dist > 0:
            meters_per_px = config.stump_width_m / px_dist
    if meters_per_px is None:
        notes.append("Could not estimate meters-per-pixel; speed will remain in px/s where needed")

    net_corners = [tuple(image_points[k]) for k in optional if k in image_points]
    if len(net_corners) < 4:
        notes.append("Net plane approximation incomplete (<4 corners)")

    return SceneCalibration(
        image_points=image_points,
        ground_homography=homography,
        meters_per_px_ground=meters_per_px,
        net_corners_px=net_corners,
        notes=notes + homography.notes,
    )


def save_scene_calibration(path: str | Path, calibration: SceneCalibration) -> None:
    serializable = asdict(calibration)
    serializable["ground_homography"]["matrix"] = (
        calibration.ground_homography.matrix.tolist() if calibration.ground_homography.matrix is not None else None
    )
    Path(path).write_text(json.dumps(serializable, indent=2))
