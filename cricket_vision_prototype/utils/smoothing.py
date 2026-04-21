from __future__ import annotations

import numpy as np

try:
    from scipy.signal import savgol_filter
except Exception:  # pragma: no cover - optional dependency fallback
    savgol_filter = None


def moving_average(data: np.ndarray, window: int) -> np.ndarray:
    if data.size == 0 or window <= 1:
        return data.copy()
    window = min(window, len(data))
    kernel = np.ones(window) / window
    padded = np.pad(data, (window // 2, window - 1 - window // 2), mode="edge")
    return np.convolve(padded, kernel, mode="valid")


def smooth_series(data: np.ndarray, method: str = "moving_average", window: int = 5, poly_order: int = 2) -> np.ndarray:
    if len(data) < 3:
        return data.copy()

    if method == "savgol" and savgol_filter is not None:
        w = window if window % 2 == 1 else window + 1
        w = min(w, len(data) if len(data) % 2 == 1 else len(data) - 1)
        if w < 3:
            return data.copy()
        return savgol_filter(data, window_length=w, polyorder=min(poly_order, w - 1))

    return moving_average(data, max(2, window))
