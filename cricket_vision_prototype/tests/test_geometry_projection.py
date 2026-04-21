import unittest

import numpy as np

from cricket_vision_prototype.calibration.homography import project_points, solve_homography
from cricket_vision_prototype.config import PrototypeConfig
from cricket_vision_prototype.events.event_detector import detect_events
from cricket_vision_prototype.projection.field_projection import classify_outcome, project_landing_zone
from cricket_vision_prototype.projection.net_impact import estimate_net_impact
from cricket_vision_prototype.tracking.trajectory_fitter import TrajectoryPoint
from cricket_vision_prototype.utils.geometry import angle_deg, px_per_frame_to_kmh


class GeometryProjectionTests(unittest.TestCase):
    def test_homography_projection_identity(self) -> None:
        src = np.array([[0, 0], [1, 0], [0, 1], [1, 1]], dtype=np.float32)
        dst = np.array([[0, 0], [2, 0], [0, 2], [2, 2]], dtype=np.float32)
        result = solve_homography(src, dst)
        self.assertIsNotNone(result.matrix)
        projected = project_points(np.array([[0.5, 0.5]], dtype=np.float32), result.matrix)
        self.assertAlmostEqual(projected[0][0], 1.0, places=2)
        self.assertAlmostEqual(projected[0][1], 1.0, places=2)

    def test_net_impact_normalization(self) -> None:
        track = [(50.0, 50.0), (80.0, 80.0)]
        corners = [(0.0, 0.0), (100.0, 0.0), (0.0, 100.0), (100.0, 100.0)]
        result = estimate_net_impact(track, corners)
        self.assertAlmostEqual(result.impact_x_ratio or 0, 0.8, places=2)
        self.assertAlmostEqual(result.impact_y_ratio or 0, 0.8, places=2)
        self.assertTrue(result.approximate)

    def test_speed_conversion(self) -> None:
        kmh, method = px_per_frame_to_kmh(px_per_frame=3.0, meters_per_px=0.02, fps=60)
        self.assertEqual(method, "scale_velocity")
        self.assertIsNotNone(kmh)
        self.assertGreater(kmh or 0, 10)

    def test_field_projection_and_outcome(self) -> None:
        cfg = PrototypeConfig()
        net = estimate_net_impact([(20, 20), (80, 20)], [(0, 0), (100, 0), (0, 100), (100, 100)])
        projection = project_landing_zone((20, 20), net, 90, 0.2, cfg, calibration_quality=0.7, track_quality=0.8)
        self.assertIsNotNone(projection.projected_distance_m)
        self.assertTrue(projection.approximate)
        self.assertIn(
            projection.projected_outcome_label,
            {"likely_dot", "likely_single", "likely_two", "likely_four", "likely_six", "uncertain"},
        )
        self.assertAlmostEqual(angle_deg((0, 0), (1, 0)), 0.0)
        self.assertEqual(classify_outcome(10), "likely_dot")

    def test_event_detection_includes_key_candidates(self) -> None:
        trajectory = [
            TrajectoryPoint(0, 0.0, 10, 20, 10, 20, 0.8),
            TrajectoryPoint(1, 0.02, 20, 24, 20, 24, 0.8),
            TrajectoryPoint(2, 0.04, 30, 31, 30, 31, 0.8),
            TrajectoryPoint(3, 0.06, 40, 26, 40, 26, 0.8),
            TrajectoryPoint(4, 0.08, 50, 22, 50, 22, 0.8),
            TrajectoryPoint(5, 0.10, 60, 18, 60, 18, 0.8),
        ]
        events = detect_events(trajectory, [(0, 0), (100, 0), (0, 100), (100, 100)])
        event_types = {e.event_type for e in events}
        self.assertIn("release", event_types)
        self.assertIn("probable_contact", event_types)
        self.assertIn("track_terminal", event_types)


if __name__ == "__main__":
    unittest.main()
