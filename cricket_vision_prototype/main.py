from __future__ import annotations

import argparse
from pathlib import Path

import cv2
import numpy as np

from cricket_vision_prototype.calibration.camera_calibration import load_intrinsics, undistort_frame
from cricket_vision_prototype.calibration.scene_calibration import build_scene_calibration, save_scene_calibration
from cricket_vision_prototype.config import load_config
from cricket_vision_prototype.events.event_detector import detect_events
from cricket_vision_prototype.projection.field_projection import project_landing_zone
from cricket_vision_prototype.projection.net_impact import estimate_net_impact
from cricket_vision_prototype.tracking.ball_detector import HeuristicBallDetector
from cricket_vision_prototype.tracking.ball_tracker import BallTracker
from cricket_vision_prototype.tracking.trajectory_fitter import estimate_speeds, fit_trajectory
from cricket_vision_prototype.utils.io import ensure_dir, write_csv, write_json
from cricket_vision_prototype.utils.logging_utils import configure_logging, get_logger
from cricket_vision_prototype.visualization.overlays import draw_overlays
from cricket_vision_prototype.visualization.plots import create_topdown_summary


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Single-camera cricket net analysis prototype")
    parser.add_argument("--video", required=True, help="Path to input video")
    parser.add_argument("--config", required=True, help="Path to YAML config")
    parser.add_argument("--output-dir", default="cricket_vision_prototype/outputs/run", help="Output directory")
    parser.add_argument("--interactive-calibration", action="store_true", help="Open click UI for calibration points")
    parser.add_argument("--points-json", default=None, help="Path to saved calibration points JSON")
    parser.add_argument("--save-calibration", default=None, help="Where to persist calibration result JSON")
    parser.add_argument("--intrinsics", default=None, help="Optional OpenCV intrinsics XML/YAML")
    parser.add_argument("--log-level", default="INFO")
    return parser.parse_args()


def run() -> None:
    args = parse_args()
    configure_logging(args.log_level)
    logger = get_logger("cricket_net")

    config = load_config(args.config)
    output_dir = ensure_dir(args.output_dir)

    cap = cv2.VideoCapture(args.video)
    if not cap.isOpened():
        raise FileNotFoundError(f"Could not open video: {args.video}")

    fps = config.frame_rate_override or cap.get(cv2.CAP_PROP_FPS)
    fps = fps if fps and fps > 0 else 30.0

    cap.set(cv2.CAP_PROP_POS_FRAMES, config.calibration_frame_idx)
    ok, calib_frame = cap.read()
    if not ok or calib_frame is None:
        raise RuntimeError("Failed to read calibration frame")

    intrinsics = load_intrinsics(args.intrinsics) if args.intrinsics else None
    calib_frame = undistort_frame(calib_frame, intrinsics)

    scene_calibration = build_scene_calibration(
        frame=calib_frame,
        config=config,
        interactive=args.interactive_calibration,
        points_path=args.points_json,
    )

    if args.save_calibration:
        save_scene_calibration(args.save_calibration, scene_calibration)

    cap.set(cv2.CAP_PROP_POS_FRAMES, 0)

    detector = HeuristicBallDetector(config.tracker)
    tracker = BallTracker(config.tracker)

    frame_idx = 0
    representative_frame = None
    while True:
        ok, frame = cap.read()
        if not ok or frame is None:
            break

        frame = undistort_frame(frame, intrinsics)
        if representative_frame is None:
            representative_frame = frame.copy()

        ts = frame_idx / fps
        detections = detector.detect(frame, frame_idx, ts)
        tracker.update(detections)
        frame_idx += 1

    cap.release()

    track_result = tracker.result()
    trajectory = fit_trajectory(track_result.filtered_track, config)
    events = detect_events(trajectory, scene_calibration.net_corners_px)
    net_impact = estimate_net_impact([(p.x_smooth_px, p.y_smooth_px) for p in trajectory], scene_calibration.net_corners_px)
    speeds = estimate_speeds(trajectory, fps, scene_calibration.meters_per_px_ground)

    contact_event = next((e for e in events if e.event_type == "probable_contact"), None)
    contact_point = None
    if contact_event is not None:
        hit = next((p for p in trajectory if p.frame_idx == contact_event.frame_idx), None)
        if hit:
            contact_point = (hit.x_smooth_px, hit.y_smooth_px)
    if contact_point is None and trajectory:
        midpoint = trajectory[len(trajectory) // 2]
        contact_point = (midpoint.x_smooth_px, midpoint.y_smooth_px)

    net_event = next((e for e in events if e.event_type == "net_hit_candidate"), None)
    observed_t = None
    if contact_event and net_event:
        observed_t = max(0.01, net_event.timestamp_sec - contact_event.timestamp_sec)

    projection = project_landing_zone(
        contact_point_px=contact_point,
        net_impact=net_impact,
        post_contact_speed_kmh=speeds.speed_post_contact_kmh,
        observed_contact_to_net_time_s=observed_t,
        config=config,
        calibration_quality=scene_calibration.quality,
        track_quality=track_result.track_confidence,
    )

    representative = representative_frame if representative_frame is not None else np.zeros((720, 1280, 3), dtype=np.uint8)
    if speeds.speed_post_contact_kmh is not None:
        speed_label = f"post ~{speeds.speed_post_contact_kmh:.1f} km/h (approx)"
    elif speeds.speed_post_contact_pxps is not None:
        speed_label = f"post ~{speeds.speed_post_contact_pxps:.1f} px/s (approx)"
    else:
        speed_label = "speed unavailable"

    annotated = draw_overlays(
        representative,
        trajectory,
        events,
        scene_calibration.net_corners_px,
        net_impact,
        speed_label,
        confidence=min(track_result.track_confidence, projection.confidence),
    )
    cv2.imwrite(str(output_dir / "annotated_frame.jpg"), annotated)

    topdown = create_topdown_summary(projection, net_impact, config)
    cv2.imwrite(str(output_dir / "topdown_summary.jpg"), topdown)

    track_rows = [
        {
            "frame_idx": p.frame_idx,
            "timestamp_sec": p.timestamp_sec,
            "x_px": p.x_px,
            "y_px": p.y_px,
            "x_smooth_px": p.x_smooth_px,
            "y_smooth_px": p.y_smooth_px,
            "confidence": p.confidence,
        }
        for p in trajectory
    ]
    write_csv(output_dir / "ball_track.csv", list(track_rows[0].keys()) if track_rows else ["frame_idx"], track_rows)

    event_rows = [
        {
            "event_type": e.event_type,
            "frame_idx": e.frame_idx,
            "timestamp_sec": e.timestamp_sec,
            "confidence": e.confidence,
            "approximate": e.approximate,
            "evidence": e.evidence,
        }
        for e in events
    ]
    write_csv(output_dir / "events.csv", list(event_rows[0].keys()) if event_rows else ["event_type"], event_rows)

    notes = [
        "All outputs are approximate. Do not use for official umpiring or exact biomechanical reconstruction.",
        "Single-camera setup cannot recover exact 3D trajectory.",
        *scene_calibration.notes,
        *net_impact.notes,
        *speeds.notes,
        *projection.notes,
    ]

    summary = {
        "video_name": Path(args.video).name,
        "fps": fps,
        "calibration_quality": scene_calibration.quality,
        "ball_track_confidence": track_result.track_confidence,
        "events": event_rows,
        "net_impact": {
            "impact_x_ratio": net_impact.impact_x_ratio,
            "impact_y_ratio": net_impact.impact_y_ratio,
            "impact_point_px": net_impact.impact_point_px,
            "impact_point_net_plane": net_impact.impact_point_net_plane,
            "confidence": net_impact.confidence,
            "approximate": net_impact.approximate,
        },
        "speed_estimates": {
            "speed_pre_contact_kmh": speeds.speed_pre_contact_kmh,
            "speed_post_contact_kmh": speeds.speed_post_contact_kmh,
            "speed_pre_contact_pxps": speeds.speed_pre_contact_pxps,
            "speed_post_contact_pxps": speeds.speed_post_contact_pxps,
            "method_used": speeds.method_used,
            "confidence": speeds.confidence,
            "approximate": speeds.approximate,
        },
        "projection": {
            "projected_angle_deg": projection.projected_angle_deg,
            "projected_distance_m": projection.projected_distance_m,
            "projected_landing_xy_m": projection.projected_landing_xy_m,
            "projected_outcome_label": projection.projected_outcome_label,
            "uncertainty_radius_m": projection.uncertainty_radius_m,
            "confidence": projection.confidence,
            "approximate": projection.approximate,
        },
        "approximate_output": True,
        "notes": notes,
    }

    write_json(output_dir / "summary.json", summary)
    logger.info("Analysis completed. Outputs saved in %s", output_dir)


if __name__ == "__main__":
    run()
