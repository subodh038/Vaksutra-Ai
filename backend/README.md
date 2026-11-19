# Vocalyze AI — Backend

AI-powered communication coaching engine. Analyses recorded sessions using visual, acoustic, and linguistic signals and returns structured coaching feedback in real time.

---

## What It Does

For every recorded session the backend runs a 5-stage pipeline:

1. **Visual** — gaze zone distribution, emotion blendshapes, head pose, eye contact scoring
2. **Event Detection** — collapses per-frame data into sparse timestamped anomaly events (eye contact breaks, anxiety spikes, smiles, etc.)
3. **Acoustic** — pitch variation, volume, pauses, WPM, articulation rate via ffmpeg + librosa
4. **Whisper** — transcript + word-level timestamps via Groq `whisper-large-v3`
5. **Linguistic** — filler words, weak words, run-on sentences via Groq `llama-3.1-8b-instant`

All signals are stitched onto a single millisecond timeline and returned immediately as `AnalysisResponse`. In parallel, a background task runs a strong LLM coach (Mistral / Groq) that produces detailed moment-level feedback, polled by the frontend.

---

## Stack

| Layer | Tech |
|---|---|
| API | FastAPI + Uvicorn |
| Schemas | Pydantic v2 |
| Audio decoding | ffmpeg + soundfile |
| Acoustic math (RMS, pauses) | Rust — `vocalyze_core` PyO3 extension |
| Pitch extraction | librosa `yin` (FFT-based, faster than naive Rust YIN) |
| Transcription | Groq `whisper-large-v3` — round-robin across keys, temp 0.0 |
| LLM coaching (primary) | Mistral `mistral-large-latest` |
| LLM coaching (fallback) | Groq `openai/gpt-oss-120b` |
| Auth | Supabase GoTrue JWT (`/auth/*`, rate-limited) |
| DB + video storage | Supabase Postgres + **private** `session_videos` bucket (signed upload/view URLs) |
| Rate limiting | slowapi (per-IP, applied at route level) |
| Config | pydantic-settings (`@lru_cache` singleton) |
| Logging | Python `logging` — clears on restart, console + file |

---

## Setup

**Prerequisites:** Python 3.12+, ffmpeg installed and on PATH

```powershell
# Enter the project directory
cd "Vocalyze AI Backend"

# Create and activate virtual environment
python -m venv .venv
.venv\Scripts\Activate.ps1

# Install Python dependencies
pip install -r requirements.txt

# Build the Rust acoustic extension (one-time, ~30 seconds)
# This compiles vocalyze_core — the PyO3 native module that handles
# RMS energy and pause detection faster than librosa.
# Re-run only when you edit files inside vocalyze_core/src/.
cd vocalyze_core
maturin develop --release
cd ..
```

> **What does `maturin develop --release` do?**
> It compiles the Rust code in `vocalyze_core/src/` into a native Python
> extension (`.pyd` on Windows, `.so` on Linux) and installs it directly into
> your `.venv`. After this, `import vocalyze_core` works like any normal
> Python import. The `--release` flag enables full compiler optimisations —
> without it the code runs ~10–50x slower. You only need to run this once;
> the compiled binary persists in the venv across server restarts.

**Environment variables** — create `.env` in the project root:

```env
# At least one Groq key is required (for Whisper transcription)
GROQ_API_KEY=gsk_...

# Optional: additional keys for rotation on failure
GROQ_API_KEY_1=gsk_...
GROQ_API_KEY_2=gsk_...

# Required for LLM coaching (primary coach model)
MISTRAL_API_KEY=...
```

See `.env.example` for the full list of supported variables.

---

## Running

```powershell
uvicorn main:app --reload --port 8000
```

- API docs: `http://localhost:8000/docs`
- Health check: `http://localhost:8000/`
- Logs: `logs/vocalyze.log` (cleared on every restart — current session only)

---

## Endpoints

All routes except `/`, `/cron`, and `/auth/*` require `Authorization: Bearer <JWT>`.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/auth/signup` | Create account (5/min). Returns access + refresh tokens. |
| `POST` | `/auth/login` | Log in (10/min). |
| `POST` | `/auth/refresh` | Exchange refresh token (30/min). |
| `POST` | `/auth/logout` | Acknowledge sign-out (client clears tokens). |
| `GET` | `/auth/me` | Current user id/email/name. |
| `GET` | `/topics/generate?mode=` | Personalised, anti-repetition speaking topic (memory-aware). |
| `POST` | `/uploads/video/upload-url` | Signed Supabase upload URL (10/min) — video bytes go browser→storage directly. |
| `GET` | `/uploads/video/view-url?path=` | Signed playback URL for a private stored video (60/min). |
| `POST` | `/analyze` | Submit audio + frame data. Saves session immediately; returns `AnalysisResponse`. Fires background LLM coaching (5/min). |
| `GET` | `/analyze/coach/{session_id}` | Poll coaching report: `202` while processing (15-min grace), JSON when ready, `500` after grace if the background task failed. |
| `GET` | `/sessions` · `/sessions/{id}` | Session history for the authenticated user. |
| `GET` | `/profile` | Coaching profile — the "Soul" (stats + user_core/skill_memory status). |
| `GET` | `/` · `/cron` | Health probe · keep-alive. |

### POST /analyze — Request

```
Content-Type: multipart/form-data

Fields:
  audio       File    WebM audio blob (decoded length capped at 10 min server-side)
  frame_data  String  JSON — FrameAnalysisPayload from frontend MediaPipe
                      (per-frame: browRaiseScore, cheekSquintScore, gazeXBs/YBs, …)
  mode        String  "impromptu" (default) — interview/presentation pending scoring
  topic       String  The prompt the speaker answered (feeds LLM context)
  video_url   String  Storage path from the signed upload (optional)
```

### POST /analyze — Response

```json
{
  "overall_score": 72.4,
  "feedback": ["Slow down — your pace was 180 WPM, target 120-160."],
  "gaze": { "center_pct": 61.0, "away_pct": 39.0 },
  "emotion": { "avg_brow_raise": 0.12, "avg_smile": 0.31 },
  "acoustic_stats": { "wpm": 180.0, "pitch_variation": 28.3 },
  "detected_events": [{ "type": "eye_contact_break", "start_ms": 4200, "end_ms": 5100 }],
  "transcript": "Good morning everyone...",
  "calibration_session_id": "uuid",
  "pipeline_status": { "is_partial": false, "warnings": [] }
}
```

The session row is written **before** this response returns; the background task patches `coaching_report` into it afterward.

---

## Testing & Verification

```powershell
.venv\Scripts\python.exe -m pytest tests/ -q      # 61 passed, 1 skipped*
.venv\Scripts\python.exe smoke_test.py            # runtime checks with logs:
                                                  # fast-path report, hallucination
                                                  # guard, duration plumbing,
                                                  # key_metrics, route registration
```

\* skipped only when the Rust extension is active (librosa-branch test).

---

## Coaching Modes

| Mode | Status | Description |
|------|--------|-------------|
| `impromptu` | ✅ Full | Composite score across visual, fluency, and linguistic signals |
| `feynman` | ✅ Full | Feynman technique — clarity, simplicity, analogy use |
| `interview` | ⚠️ Partial | In development |
| `presentation` | ⚠️ Partial | In development |

---

## How the Score Is Calculated

All scores are in the range **0–100**. Each mode uses a different weighted formula.

### Impromptu Mode

```
overall_score = 0.35 × Verbal Fluency
              + 0.20 × Language Quality
              + 0.20 × Vocal Delivery
              + 0.25 × Presence & Composure
```

| Pillar | Weight | Sub-signals |
|--------|--------|-------------|
| **Verbal Fluency** | 35% | Filler ratio (10%), Pace/WPM (12%), Pause quality (8%), Articulation rate (5%) |
| **Language Quality** | 20% | Run-on sentences (5%), Weak/hedge words (5%), Vocabulary range (5%), Filler-to-content ratio (5%) |
| **Vocal Delivery** | 20% | Pitch variation (10%), Volume (5%), Silence ratio (5%) |
| **Presence & Composure** | 25% | Gaze center (12%), Brow relaxation (7%), Head pose stability (3%), Warmth/smile (3%) |

> The frontend's "Weighted Score Breakdown" panel mirrors this formula exactly — if you change weights here, change `DiagnosticComponents.tsx` too.

---

### Why Each Weight Is What It Is

#### Verbal Fluency — 35%
The highest weight because fluency is the most immediately perceived quality in spontaneous speech. A listener notices filler words, awkward pace, and stumbling before they notice vocabulary or pitch.

- **Filler ratio 10%** (was 15%) — Reduced. Fillers ("um", "uh", "like") are natural thinking pauses in impromptu speech. Still penalised at high levels (>12%) but no longer the single dominant sub-signal — that was inconsistent with the mode's tolerance for natural speech patterns.
- **Pace/WPM 12%** (was 10%) — How fast you speak under pressure is one of the clearest impromptu signals. Too fast = anxiety, no time for ideas to land. Too slow = low energy. Increased because it is a primary and reliable signal.
- **Pause quality 8%** (was 5%) — Intentional silence is a core impromptu skill. A speaker who can pause for 1 second, collect their thought, and then speak clearly is demonstrating exactly what this mode tests. Strategic pauses (300–800 ms) reward confidence; long, frequent pauses (>1500 ms) penalise getting lost.
- **Articulation rate 5%** — Unchanged. Measures speech density excluding pauses — distinct from WPM. Sweet spot: 150–180 WPM.

#### Language Quality — 20%
Reduced from 30%. Language quality metrics were originally borrowed from prepared-speech evaluation. For impromptu, the standards must be softer because the speaker is pulling from working memory, not a rehearsed script.

- **Run-on sentences 5%** (was 10%) — Run-ons are a natural feature of spontaneous thought. Penalising them at 10% was treating spoken language like written text. Reduced — still signals tangled thinking at extremes but doesn't dominate the score.
- **Weak/hedge words 5%** (was 8%) — "I think", "kind of", "basically" are sometimes appropriate in impromptu — the speaker genuinely is uncertain. Reduced from 8% because heavy penalisation of hedging punishes honesty.
- **Vocabulary range 5%** (was 7%) — Repeated words signal limited recall under pressure. Still penalised, but softened — impromptu speakers legitimately reuse words when thinking fast.
- **Filler-to-content ratio 5%** — Signal-to-noise ratio of actual content vs filler. Kept equal to others — provides a complementary view to raw filler ratio.

#### Vocal Delivery — 20%
Kept unchanged. Vocal delivery is equally important in impromptu as in prepared speech — monotone delivery loses the audience regardless of preparation level.

- **Pitch variation 10%** — The largest sub-signal. Monotone delivery (pitch std < 15 Hz) is one of the most common and most damaging problems in live speaking. Vocal range keeps listeners engaged. Sweet spot: 25–50 Hz standard deviation.
- **Volume 5%** — Mumbling (avg RMS < 0.005) signals lack of confidence and makes the speaker hard to follow. Penalised proportionally — not a dominant factor but a real one.
- **Silence ratio 5%** — 10–25% silence in a recording is natural breathing and thought collection. Below 5% = steamrolling. Above 45% = the speaker couldn't sustain the conversation.

#### Presence & Composure — 25%
Increased from 15%. Impromptu speaking is fundamentally a test of **how you perform under pressure without preparation**. Composure, gaze, and body language are the core skills being evaluated — they were underweighted at 15%.

- **Gaze center 12%** (was Eye contact 6%) — The primary presence signal. Uses `gaze.center_pct` — the percentage of frames where the speaker was looking at the camera center zone. Range: 0–100% naturally. Replaces `eyeContactScore` which MediaPipe caps at approximately 0.55–0.60 even for perfect eye contact, making the old score unfairly penalise good speakers.
- **Brow relaxation 7%** (was "Low anxiety" 4%) — Scored from `avg_brow_raise` (MediaPipe `browInnerUp`, AU1). Renamed honestly: browInnerUp fires on surprise and emphasis too, so it is treated as an observable composure signal, never an anxiety diagnosis. Low sustained activation reads as composed.
- **Head pose stability 3%** (new) — `headPoseScore` from MediaPipe measures head orientation alignment. A stable, forward-facing head position signals confidence and engagement. Previously unused despite being available in every frame.
- **Warmth/smile 3%** (was 3%) — Unchanged. Smile is now computed as a per-side average on the frontend (was a sum that saturated). Kept small — forced smiles are not a speaking skill, so this has intentionally low weight.
- **Stress removed** (was 2%) — Stress score was largely redundant with brow tension (both measure nervous arousal). Removing it freed weight for more distinct signals.

**Sweet spots (full 100 pts for that sub-signal):**
- Pace: 120–160 WPM
- Articulation rate: 150–180 WPM
- Filler ratio: ≤ 2% (zero score at ≥ 12%)
- Pitch variation: 25–50 Hz std deviation
- Silence ratio: 10–25% of total duration
- Pause average: 300–800 ms

**Fallback:** If the acoustic or linguistic pipeline stage fails, that sub-score falls back to a neutral **65/100** rather than 0 — a pipeline failure does not tank the speaker's score.

---

### Feynman Mode

```
overall_score = 0.25 × Low filler ratio
              + 0.20 × Low run-on sentences
              + 0.20 × Low repeated words
              + 0.20 × WPM in ideal range
              + 0.15 × Eye contact
```

| Signal | Weight | Rationale |
|--------|--------|-----------|
| **Filler ratio** | 25% | Fillers signal knowledge gaps in the Feynman method |
| **Run-on sentences** | 20% | Tangled sentences = tangled thinking |
| **Repeated words** | 20% | Loops indicate circular reasoning |
| **WPM (100–140)** | 20% | Slower pace lets concepts land with the listener |
| **Eye contact** | 15% | Confidence that you understand your own material |

**Score bands:**
- ≥ 78 → 🌟 Excellent
- 55–77 → 📈 Good foundation
- < 55 → 💪 Room to grow

---

## Project Docs

| File | Contents |
|---|---|
| [`Architecture.md`](Architecture.md) | Full pipeline design, data contracts, endpoint reference, directory structure |
| [`Backlog.md`](Backlog.md) | Known issues, pending features, testing gaps |
| [`Research.md`](Research.md) | Rationale behind thresholds and design decisions |
| [`Limitations.md`](Limitations.md) | Known constraints and trade-offs |
