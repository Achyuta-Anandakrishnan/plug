from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass

import cv2
import numpy as np

from cricket_vision_prototype.config import TrackerConfig


@dataclass
class Detection:
    frame_idx: int
    timestamp_sec: float
    x_px: float
    y_px: float
    confidence: float
    area_px: float


class BallDetector(ABC):
    @abstractmethod
    def detect(self, frame: np.ndarray, frame_idx: int, timestamp_sec: float) -> list[Detection]:
        raise NotImplementedError


class HeuristicBallDetector(BallDetector):
    """Motion-first detector for small, fast cricket-ball candidates."""

    def __init__(self, tracker_cfg: TrackerConfig) -> None:
        self.cfg = tracker_cfg
        self.bg = cv2.createBackgroundSubtractorMOG2(history=400, varThreshold=20, detectShadows=False)

    def detect(self, frame: np.ndarray, frame_idx: int, timestamp_sec: float) -> list[Detection]:
        fg = self.bg.apply(frame)
        fg = cv2.GaussianBlur(fg, (5, 5), 0)
        _, fg = cv2.threshold(fg, 200, 255, cv2.THRESH_BINARY)

        contours, _ = cv2.findContours(fg, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        detections: list[Detection] = []

        for contour in contours:
            area = cv2.contourArea(contour)
            if area < self.cfg.min_contour_area_px or area > self.cfg.max_contour_area_px:
                continue

            perimeter = cv2.arcLength(contour, True)
            if perimeter <= 0:
                continue

            circularity = 4 * np.pi * area / (perimeter * perimeter)
            if circularity < self.cfg.min_circularity:
                continue

            (x, y), radius = cv2.minEnclosingCircle(contour)
            confidence = float(np.clip((circularity * 0.6) + (min(radius, 12) / 12) * 0.4, 0.0, 1.0))

            detections.append(
                Detection(
                    frame_idx=frame_idx,
                    timestamp_sec=timestamp_sec,
                    x_px=float(x),
                    y_px=float(y),
                    confidence=confidence,
                    area_px=float(area),
                )
            )

        detections.sort(key=lambda d: d.confidence, reverse=True)
        return detections
