# AI Cricket Scoring Cam — Production Blueprint

## 0) How to Use This Document

This is a production-grade implementation blueprint for an iPhone-first cricket scoring camera app that runs from a device mounted behind a net, tracks ball outcomes, and powers full match operations.

It is intentionally split into **execution chunks** that can be owned in parallel by:

- **Builder-B** (mobile UX + client architecture)
- **Builder-Ray** (backend, data, AI infra, reliability)
- **Shared** (cross-team integration, quality gates)

> Principle: ship a valuable scorer first, then progressively automate more decisions as confidence improves.

---

## 1) Product North Star

### Primary promise
"Set your phone behind the net and score a real cricket match with AI-assisted ball events, fast edits, and instant match outputs."

### Core user outcomes
- Start a match in under 60 seconds.
- Score each ball with zero typing in common cases.
- Resolve ambiguous events in under 2 taps.
- Export scorecards, innings timeline, and basic shot maps immediately.

### User types
- Casual players in nets
- Club scorers
- Academy coaches
- Content creators (training clips + analytics)

---

## 2) MVP vs Expansion

## MVP (must-have)
- Match creation (teams, players, overs format)
- Ball-by-ball scoring engine
- Camera capture mode with AI suggestions
- Manual override + undo/redo
- Basic dismissals (bowled, caught manual confirmation)
- Scorecard + innings summary + share

## V1.5
- Wagon wheel heat zones
- Auto striker/non-striker tracking improvements
- Team templates
- Offline-first sync conflict handling

## V2+
- LiDAR depth fusion for trajectory confidence
- Catch probability hints
- Multi-camera mode
- Coach insights + session reports

---

## 3) Architecture Overview

## Client (iOS)
- SwiftUI app shell
- AVFoundation camera pipeline
- CoreML inference + post-processing
- Local scoring state machine
- Event queue for sync

## Backend
- Auth + user/team/match services
- Ball-event ingestion and reconciliation
- Media artifact index
- Analytics aggregation pipelines
- Push notifications

## AI services
- On-device model for near-realtime detection
- Optional server-side reprocessing for high-fidelity analytics
- Confidence + dispute flags persisted per ball event

## Data strategy
- Local-first event sourcing
- Immutable ball event ledger + correction events
- Derived tables/materialized views for fast UI queries

---

## 4) Non-Functional Requirements

- **Latency:** scoring suggestion < 350ms after ball completion
- **Reliability:** no data loss for offline sessions up to 2 hours
- **Battery:** <= 20%/hr in camera scoring mode target
- **Privacy:** minimize cloud video upload by default
- **Security:** signed event payloads, auth hardening, anti-tamper checks
- **Scalability:** handle tournament-day spikes (10x baseline)

---

## 5) Information Architecture (All Pages)

## A. Onboarding + Permissions
1. Welcome
2. Camera permission
3. Motion permission (if needed)
4. Local notifications
5. Quick tutorial (mounting phone)

## B. Home / Dashboard
- Start Match CTA
- Resume In-Progress Match
- Recent Matches
- Team Shortcuts
- Device Setup Health

## C. Match Setup Wizard
1. Match format
2. Teams and players
3. Toss + decision
4. Ground/pitch profile
5. Camera placement guide

## D. Live Scoring Hub
- Live score ribbon
- Ball feed timeline
- Camera frame + pitch overlay
- AI outcome suggestion tray
- Override controls
- Wicket workflow panel

## E. Ball Review Panel
- Frame scrubber
- Event confidence chart
- Edit outcome, extras, dismissal metadata
- Audit reason selector

## F. Scorebook Page
- Over-by-over entries
- Batter and bowler cards
- Extras breakdown
- Partnership blocks

## G. Match Summary Page
- Result card
- Innings graph
- Shot zone map
- Key wickets/runs
- Share/export actions

## H. Teams & Players
- Team roster management
- Player profiles
- Batting/bowling style fields

## I. Settings
- Camera profile presets
- Scoring defaults
- Notification prefs
- Data & privacy controls
- Account/subscription

## J. Admin/Support (internal)
- Session logs
- Crash traces
- Event reconciliation queue
- Model drift dashboard

---

## 6) UI System — Glassmorphism Modern Spec

## Visual language
- Frosted cards on layered gradient backdrops
- Subtle depth with translucent surfaces
- Motion-rich micro-interactions
- Strong contrast text for outdoor readability

## Design tokens
- Surface blur levels: 8 / 16 / 24
- Opacity tokens: 0.12 / 0.18 / 0.24
- Border stroke: 1px white @ 22% alpha
- Corner radii: 14, 18, 24
- Elevation shadows: soft + ambient dual shadow stack

## Color strategy
- Primary accent: electric cyan or neon mint
- Success: luminous green
- Danger: coral red
- Warning: amber
- Neutral text hierarchy with high readability

## Typography
- Compact scoreboard numerics with tabular figures
- Headline: bold geometric sans
- Body: medium humanist sans
- Micro labels: uppercase spaced tracking

## Motion
- 120–220ms tap transitions
- 280ms panel slide
- Spring-based card bounce for confirmed ball events
- Haptics for wicket, boundary, and undo

## Accessibility
- High contrast mode toggle
- Reduced transparency fallback theme
- Dynamic type support
- VoiceOver labels for all critical controls

---

## 7) Page-by-Page Production Requirements

## 7.1 Onboarding
### UI
- Progressive card stack with illustrations
- Permission request timing after context explanation

### Backend
- User profile init
- Device capability snapshot (camera fps tiers)

### Edge cases
- Permission denied recovery
- Low-end device safe mode

## 7.2 Home Dashboard
### UI
- Hero card for next action
- Glass cards: recent matches, stats, setup status

### Backend
- Fetch recent sessions, drafts, team templates
- Sync badge with pending local events

### Edge cases
- Offline state banner
- Partial data hydration

## 7.3 Match Setup Wizard
### UI
- Stepper with validation gates
- Smart defaults from recent match

### Backend
- Create draft match object
- Assign roster and inning config

### Edge cases
- Incomplete teams
- Duplicate player names

## 7.4 Live Scoring Hub
### UI
- Dual-pane: camera + score controls
- Persistent compact scoreboard
- Suggestion chips with confidence percent

### Backend
- Event append endpoint (idempotent)
- Realtime stream channel for score updates

### AI behavior
- Detect ball trajectory and shot direction
- Produce top-3 candidate outcomes
- Flag low confidence for manual confirm

### Edge cases
- Frame drops
- Occluded ball
- False-positive wicket

## 7.5 Ball Review
### UI
- Timeline thumbnails
- Adjustable event metadata panel

### Backend
- Correction event write (never mutate original event)
- Reason codes for audit analytics

### Edge cases
- Concurrent edits from two devices
- Missing video segment

## 7.6 Scorebook
### UI
- Sticky overs grid
- Expandable batter/bowler details

### Backend
- Query derived innings totals
- Fallback client recomputation

### Edge cases
- Suspended innings
- Super over entries

## 7.7 Match Summary
### UI
- Story-style recap blocks
- Share sheet for image/pdf/link

### Backend
- Summary generation job
- Artifact caching

### Edge cases
- Incomplete innings state
- Shared link permissions

## 7.8 Teams & Players
### UI
- Editable roster cards
- Role badges (WK/Captain/Bowler)

### Backend
- Team CRUD + roster version history

### Edge cases
- Player merged/renamed
- Soft-deleted users

## 7.9 Settings
### UI
- Grouped glass sections
- Dangerous actions with confirmation sheets

### Backend
- Prefs store + migration-aware defaults

### Edge cases
- Cross-device preference conflicts

---

## 8) Scoring Domain Model (Canonical)

## Entities
- User
- Team
- Player
- Match
- Innings
- Over
- BallEvent (immutable)
- BallCorrectionEvent
- Dismissal
- CameraSession
- MediaClip
- SyncBatch

## BallEvent required fields
- match_id
- innings_no
- over_no
- ball_in_over
- striker_id
- bowler_id
- runs_batter
- extras_type
- extras_runs
- wicket_type
- dismissed_player_id
- outcome_source (AI/manual/mixed)
- confidence_score
- event_ts
- device_event_id

## Derived values
- total score
- wickets fallen
- run rate
- required run rate
- strike rate / economy

---

## 9) Event Sourcing and Corrections

- Original events are append-only.
- Edits create correction events referencing original `device_event_id`.
- Read model projects latest effective state.
- Maintain full audit trail for dispute/analysis.

## Conflict resolution
- Last-writer-wins only for non-critical UI prefs.
- For scoring events: deterministic sequence + conflict queue.
- Manual human resolution workflow for ambiguous merges.

---

## 10) AI/ML Pipeline

## On-device inference stages
1. Frame preprocessing
2. Ball candidate detection
3. Temporal association (track ID)
4. Trajectory estimation
5. Event classification (dot/run/boundary/wicket hint)
6. Confidence scoring

## Server-side optional enrichment
- Higher-fidelity reprocess on uploaded clips
- Field zone mapping normalization
- Training dataset generation

## Model telemetry
- Precision/recall by lighting profile
- False wicket rate
- Confidence calibration drift

## Safety
- Never auto-finalize critical wicket types without confirm in MVP
- Always expose correction controls within one tap

---

## 11) Camera + Vision Engineering Details

- Target capture rates: 60fps baseline, 120fps high-performance devices
- Dynamic exposure lock in bright backgrounds
- Pitch ROI calibration using corner markers
- Net pattern suppression heuristics
- Motion stabilization compensation

## Calibration flow
- User marks crease, stumps, pitch bounds
- Save profile per venue/court
- Confidence check with sample throw

## Failure fallback
- If confidence < threshold, auto-switch to assisted-manual mode

---

## 12) Backend Services Blueprint

## Service modules
- auth-service
- match-service
- scoring-service
- media-service
- analytics-service
- notification-service
- admin-observability-service

## API principles
- Idempotent writes with request IDs
- Cursor pagination for feeds
- ETag caching for heavy summaries
- Strict schema versioning

## Realtime
- Websocket channel: match/{id}/live
- Event types: score_update, wicket_alert, correction_applied, sync_status

---

## 13) Security, Abuse, and Privacy

- JWT + rotating refresh tokens
- Device binding for scoring sessions
- Signed event packets to prevent forged score injections
- Role-based permissions (scorer, captain, viewer)
- PII minimization
- Encrypted at rest and in transit

## Abuse controls
- Rate limiting for event writes
- Suspicious edit burst detection
- Admin review queues

---

## 14) Observability & Ops

## Metrics
- Match start success rate
- Ball suggestion latency p50/p95
- Edit frequency per over
- Crash-free sessions
- Sync lag

## Logs
- Structured logs with match/session correlation IDs

## Alerts
- Scoring event write failure spikes
- Drift in model confidence distributions
- Elevated correction rates for specific device types

---

## 15) QA Strategy

## Test types
- Unit: scoring rules, strike rotation, extras handling
- Integration: event ingestion + projection correctness
- E2E: full match flow with offline mode
- Device tests: camera performance matrix by iPhone model

## Golden scenarios
- No-ball + boundary
- Wicket on free hit edge case
- Overthrow extras
- Undo/redo across over boundary
- Rain pause / resumed innings

## Chaos tests
- Mid-over app crash recovery
- Network loss + delayed sync
- Duplicate event submissions

---

## 16) Release Plan

## Alpha (internal)
- Manual-first with AI hints
- Instrumentation-heavy

## Closed Beta
- Selected clubs/academies
- Weekly model recalibration

## Public Launch
- Stable score reliability thresholds
- Full support docs + in-app onboarding

---

## 17) Roadmap Chunks for Builder-B and Builder-Ray

## Chunk B1 — Design System + App Shell (Builder-B)
**Scope**
- Build global glassmorphism design tokens
- Implement navigation shell, typography, spacing
- Accessibility toggles

**Deliverables**
- Token file + reusable components
- Theme switch (default/high contrast)
- Motion + haptics baselines

**Definition of done**
- All core pages use shared component library
- Contrast tests pass in bright-mode simulation

## Chunk B2 — Match Setup + Home (Builder-B)
**Scope**
- Dashboard and setup wizard
- Team/player picker UX

**Deliverables**
- Draft match creation flow
- Resume draft match from home

**Definition of done**
- New match started in < 60s average test

## Chunk B3 — Live Scoring Interface (Builder-B)
**Scope**
- Score ribbon, event chips, manual override panels
- Fast edit gestures

**Deliverables**
- Ball confirm flow <= 2 taps typical
- Undo/redo and wicket modal

**Definition of done**
- Zero-blocking flow during active over

## Chunk B4 — Scorebook + Summary + Share (Builder-B)
**Scope**
- Post-innings and post-match views
- Share export UI

**Deliverables**
- Scorecard cards
- Summary charts and highlights

**Definition of done**
- PDF/link share works for finished matches

## Chunk R1 — Core Data Model + APIs (Builder-Ray)
**Scope**
- Schema for match/innings/ball events/corrections
- CRUD and event endpoints

**Deliverables**
- Migrations
- API contracts + validation

**Definition of done**
- Event append and projection pass integration tests

## Chunk R2 — Sync + Realtime (Builder-Ray)
**Scope**
- Offline sync batch protocol
- Live websocket updates

**Deliverables**
- Idempotent ingestion
- Conflict queue and resolution API

**Definition of done**
- No data loss in simulated offline/online churn

## Chunk R3 — AI Inference Integration (Builder-Ray + Builder-B)
**Scope**
- On-device inference hooks
- Confidence and suggestion APIs

**Deliverables**
- Model wrapper SDK
- Standardized event payload format

**Definition of done**
- Suggestion latency and confidence telemetry captured

## Chunk R4 — Analytics + Observability (Builder-Ray)
**Scope**
- Aggregation pipelines
- Operational dashboards and alerts

**Deliverables**
- Match KPIs
- Drift detection reports

**Definition of done**
- Dashboard covers p95 latency, correction rate, crash trend

## Chunk S1 — Security Hardening (Shared)
**Scope**
- Auth, token, signed payloads
- Access control testing

**Definition of done**
- External pen-test checklist completed

## Chunk S2 — QA & Launch Readiness (Shared)
**Scope**
- Device matrix testing
- Regression suites
- Runbooks + support docs

**Definition of done**
- Launch gate checklist green

---

## 18) Page Component Backlog (Granular "Little Features")

## Global micro-features
- Match clock in dynamic island style header
- One-swipe "correct last ball"
- Haptic pulse for accepted AI suggestion
- Confidence color ring around suggestion chips
- Quick toggle: "manual over" mode
- Battery and thermal advisory banner
- Device tilt warning for camera alignment
- Ambient crowd sound toggle (optional)

## Home micro-features
- "Continue where you left" deep-link card
- Last 5 match streak widget
- Venue preset shortcuts
- One-tap duplicate match setup

## Setup wizard micro-features
- Auto-fill roster from previous XI
- Detect duplicate jersey numbers
- Save template per tournament format
- Confirm toss with animated coin micro-interaction

## Live scoring micro-features
- Floating ball counter dot (over progress)
- Color-coded extras chips (WD/NB/B/LB)
- "Late edit" snackbar after confirmation
- Auto-advance striker highlight
- Wicket celebration animation toggle
- "Mark as uncertain" for later review

## Ball review micro-features
- Pin favorite camera frame
- Magnifier loupe on trajectory point
- Timeline jump to all wickets
- Compare original vs corrected event

## Scorebook micro-features
- Collapse low-impact overs
- Highlight maiden overs
- Partnership break markers
- Bowler spell segmentation

## Summary micro-features
- "Turning point" auto-caption cards
- Win probability sparkline (future)
- Top performer badges
- Share as story-ready vertical card

## Team/player micro-features
- Preferred batting order templates
- Bowling quota helper
- Player availability status toggle
- Captain notes field

## Settings micro-features
- Thermal safe mode toggle
- Data saver upload mode
- Privacy lock (face ID before opening scorebook)
- Diagnostic bundle export for support

---

## 19) Production Checklists

## Engineering readiness
- Schema migration rollback tested
- API contracts versioned
- Backward compatibility for last app version

## Product readiness
- Empty/error/loading states complete on all pages
- Copy reviewed for scorer clarity
- Permission denial flows tested

## Reliability readiness
- Offline replay tested at 500+ events
- Reconnect behavior validated under packet loss

## Support readiness
- In-app FAQ and troubleshooting
- Incident escalation runbook

---

## 20) Suggested Delivery Sequence

1. B1 + R1 in parallel
2. B2 + R2 in parallel
3. B3 + R3 with tight integration loop
4. B4 + R4
5. S1 + S2 hardening sprint
6. Beta rollout

---

## 21) Acceptance Criteria (Product-Level)

- User can complete one full innings with no blocker.
- Critical scoring actions (runs, wicket, extras, undo) always reachable in <= 2 taps.
- All edits are auditable and reversible.
- Match summary generated in <= 10s after innings close.
- Session survives app restart with zero ball loss.
- High-confidence AI suggestions reduce manual input by at least 50% in test cohort.

---

## 22) Future LiDAR Expansion (Planned)

- Depth-assisted bounce point estimation
- Better separation of ball vs net artifacts
- 3D shot trajectory reconstruction
- Advanced coaching overlays (release angle, seam trajectory approximation)

Ship this only after baseline camera pipeline is stable and measurable.

---

## 23) Final Notes

- Treat the scorer as mission-critical data software, not just a camera app.
- Trust increases when correction flows are fast and transparent.
- The best version of this product is "AI-assisted, scorer-controlled" not "AI-locked." 

