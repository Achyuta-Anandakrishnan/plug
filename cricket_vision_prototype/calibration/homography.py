from __future__ import annotations

from dataclasses import dataclass

import cv2
import numpy as np


@dataclass
class HomographyResult:
    matrix: np.ndarray | None
    rms_error_px: float | None
    quality: float
    method: str
    notes: list[str]


def solve_homography(src_points: np.ndarray, dst_points: np.ndarray) -> HomographyResult:
    notes: list[str] = []
    if src_points.shape[0] < 4 or dst_points.shape[0] < 4:
        return HomographyResult(None, None, 0.0, "insufficient_points", ["Need at least 4 point correspondences"])

    matrix, mask = cv2.findHomography(src_points, dst_points, method=cv2.RANSAC)
    if matrix is None:
        return HomographyResult(None, None, 0.0, "cv2_findhomography_failed", ["OpenCV failed to solve homography"])

    reprojected = cv2.perspectiveTransform(src_points.reshape(-1, 1, 2), matrix).reshape(-1, 2)
    residual = np.linalg.norm(reprojected - dst_points, axis=1)
    rms = float(np.sqrt(np.mean(np.square(residual))))
    inlier_ratio = float(mask.mean()) if mask is not None else 0.5
    quality = float(np.clip((1.0 / (1.0 + rms)) * inlier_ratio * 2.0, 0.0, 1.0))
    if rms > 15:
        notes.append("High reprojection error; planar approximation may be weak")

    return HomographyResult(matrix, rms, quality, "ransac", notes)


def project_points(points: np.ndarray, matrix: np.ndarray) -> np.ndarray:
    return cv2.perspectiveTransform(points.reshape(-1, 1, 2), matrix).reshape(-1, 2)
