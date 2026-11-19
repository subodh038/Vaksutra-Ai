# VakSutra AI — Frontend

> AI-powered impromptu speaking coach. Pick an AI-generated prompt, record a 2-minute answer on camera, and get a multi-modal diagnostic report: gaze, delivery pacing, filler words, and LLM coaching — with a coach that remembers you across sessions.

_Last updated: August 2026 (beta-prep state). See [`Architecture.md`](Architecture.md) for structure and [`Research.md`](Research.md) for decision rationale._

---

## Current User Flow

```
Landing ──► Auth (Supabase JWT) ──► Topic Screen ──► Recording ──► Review/Report
                                        │               │              │
                             personalised topic    3s cam buffer   MediaPipe in-browser
                             via /topics/generate  2-min hard cap  + POST /analyze
```

- **Landing** — only *Impromptu Speaker* is live; Q&A / Presentation / Feynman show "Coming Soon".
- **Auth** — email/password via backend `/auth/*` (Supabase GoTrue). Tokens auto-refresh; expiry mid-session now shows the login screen **without** losing your recording.
- **Topic** — one personalised prompt from the backend (anti-repetition + coaching-memory aware), 3s prep, shuffle button.
- **Recording** — dual `MediaRecorder` streams (video VP9 ~400kbps + isolated Opus audio). Hard cap **120s** (`MAX_RECORDING_MS`) with a progress ring and a pulsing **"Ns LEFT — WRAP UP!"** cue in the final 10s. Camera-start countdown is 3s (the real prep already happened on the Topic screen).
- **Review** — auto-runs:
  1. **MediaPipe FaceLandmarker in-browser** (CPU WASM, 8× playback, adaptive 4–8 fps sampling) → per-frame gaze/emotion telemetry
  2. **Direct-to-Supabase video upload** via short-lived signed URLs — video bytes never pass through FastAPI
  3. **POST /analyze** (audio blob + frame JSON) → instant deterministic report
  4. Polls `/analyze/coach/{id}` for the async LLM coaching report (3-min deadline, then honest error)
- If MediaPipe fails, analysis **degrades gracefully to audio-only** instead of dying.

---

## Tech Stack

| Technology | Purpose |
|---|---|
| Next.js 15 + React 19 | App Router UI |
| TypeScript 5 | Type safety |
| Tailwind CSS 4 | Styling |
| @mediapipe/tasks-vision 1.0.1 | In-browser face landmarking (478 pts + 52 blendshapes) |
| Supabase Storage | Private `session_videos` bucket (signed upload/view URLs) |

---

## Setup

```bash
npm install
npm run dev   # http://localhost:3000
```

`.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```

Requires the backend running (see its README). Camera/mic need HTTPS or localhost.

---

## Signal Pipeline (per sampled frame)

| Signal | Method |
|---|---|
| Gaze zone | Iris-group offsets vs eye corners (official indices 468–472 / 473–477), head-yaw compensated |
| Gaze prototype | `eyeLook*` blendshapes → `gazeXBs`/`gazeYBs` (−1…+1), captured for offline A/B |
| Eye contact | Iris-offset score (zone classification is authoritative; backend uses `gaze.center_pct`) |
| Brow tension | `browInnerUp` (AU1) — observation, not an anxiety diagnosis (`browRaiseScore`) |
| Smile | avg(mouthSmileL/R); Duchenne guard = eyeSquint >0.15 OR cheekSquint >0.05 |
| Stress / confusion / frown | mouthPress / browDown / mouthFrown averages |
| Speaking flag | inner-lip gap > 0.01 |

Backend event gates (sustained-duration rules) live in `backend/core/visual/event_detection.py`.

## Privacy (what actually happens)

- Visual analysis runs entirely in-browser; camera frames never leave the device.
- Audio goes to FastAPI over HTTPS solely to generate the report.
- Session videos go to a **private** Supabase bucket; playback uses short-lived signed URLs. Nothing is publicly accessible.
