from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np


@dataclass
class CameraIntrinsics:
    camera_matrix: np.ndarray
    dist_coeffs: np.ndarray


def load_intrinsics(path: str | Path) -> CameraIntrinsics | None:
    p = Path(path)
    if not p.exists():
        return None

    fs = cv2.FileStorage(str(p), cv2.FILE_STORAGE_READ)
    camera_matrix = fs.getNode("camera_matrix").mat()
    dist_coeffs = fs.getNode("dist_coeff").mat()
    fs.release()

    if camera_matrix is None or dist_coeffs is None:
        return None

    return CameraIntrinsics(camera_matrix=camera_matrix, dist_coeffs=dist_coeffs)


def undistort_frame(frame: np.ndarray, intrinsics: CameraIntrinsics | None) -> np.ndarray:
    if intrinsics is None:
        return frame
    return cv2.undistort(frame, intrinsics.camera_matrix, intrinsics.dist_coeffs)
