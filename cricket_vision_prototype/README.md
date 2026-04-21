# Cricket Net Analysis Prototype (Single-Camera, Explicitly Approximate)

This is a **Python-first standalone prototype** for analyzing cricket net-practice video recorded from a fixed camera behind the net.

It estimates:
- ball image trajectory
- approximate speed (km/h when scale allows, otherwise px/s)
- normalized net impact location (`x_ratio`, `y_ratio`)
- projected landing zone on a virtual field with uncertainty radius
- event candidates: release, bounce candidate, probable contact, net-hit candidate, terminal track

## Important limitations
This tool is **not an official umpiring system** and **does not reconstruct exact 3D ball flight**.
All numeric outputs are approximate and confidence-scored.

## Project layout
```
cricket_vision_prototype/
  main.py
  config.py
  config.yaml
  calibration/
  tracking/
  events/
  projection/
  visualization/
  utils/
  outputs/
  tests/
```

## Setup
```bash
python -m venv .venv
source .venv/bin/activate
pip install -r cricket_vision_prototype/requirements.txt
```

## Run
```bash
python -m cricket_vision_prototype.main \
  --video /path/to/net_session.mp4 \
  --config cricket_vision_prototype/config.yaml \
  --interactive-calibration \
  --output-dir cricket_vision_prototype/outputs/run1
```

Or use pre-saved calibration points:
```bash
python -m cricket_vision_prototype.main \
  --video /path/to/net_session.mp4 \
  --config cricket_vision_prototype/config.yaml \
  --points-json /path/to/calibration_points.json
```

## Pipeline
1. Load video and pick calibration frame.
2. Calibrate scene from manual clicks (stumps/crease/net corners).
3. Detect moving ball candidates and track over time.
4. Smooth trajectory and compute approximate speeds.
5. Detect event candidates with confidence values.
6. Normalize net impact location.
7. Project probable landing zone on virtual field.
8. Export CSV/JSON/images.

## Outputs
Per run:
- `summary.json`
- `ball_track.csv`
- `events.csv`
- `annotated_frame.jpg`
- `topdown_summary.jpg`

### `summary.json` includes
- `events[]` with confidence + approximate flag
- `net_impact` (`impact_x_ratio`, `impact_y_ratio`, confidence)
- `speed_estimates` (km/h if calibration supports scale, else px/s)
- `projection` (angle, distance, landing xy, outcome class, uncertainty radius, confidence)
- explicit approximation notes

## Calibration notes
- Uses planar approximations from single-camera points.
- If camera intrinsics are unavailable, undistortion is skipped.
- Weak calibration lowers confidence and increases uncertainty radius.

## Extending with a learned detector
`tracking/ball_detector.py` defines `BallDetector`. You can replace `HeuristicBallDetector` with a YOLO/CoreML-backed detector later without changing downstream modules.

## Tests
```bash
python -m unittest discover -s cricket_vision_prototype/tests -p 'test_*.py'
```

## Quick iPhone live test (web)
If you want to test motion tracking live with your iPhone camera without running the Python pipeline first, use the web tester route:

```bash
npm install
npm run dev
```

Open on iPhone Safari (same network/tunnel):
- `https://<your-host>/cricket/live`

The web tester is intentionally heuristic and approximate (motion-based), and exports session JSON for quick iteration.
