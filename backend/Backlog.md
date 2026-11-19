# PendingTests.md — Pipeline Testing & Improvement Backlog

> Before moving to the stitching/LLM layer, every item below must be addressed.

## ✅ Resolved — August 2026 beta-prep pass (details in git history)

| Fix | Where |
|---|---|
| Short-session (<10 words) coaching report crashed on ghost schema fields | `services/llm_coach.py` fast path |
| Memory prompts read nonexistent report fields (`structural_analysis`, …) | `services/coaching_memory.py` |
| Coach poll returned 500 instead of 202 while processing (`.single()`) | `db/repositories/sessions.py` |
| Profile writes used literal `"now()"` strings → likely silent failures | `db/repositories/profiles.py` (ISO timestamps) |
| Session lost entirely if background task died | Save-first-patch-later flow + 15-min poll grace (`api/routes/analysis.py`) |
| Audio-only sessions hard-zeroed silence/pause scores | `RawSignals.duration_ms` plumbing + NEUTRAL guards |
| No rate limits on `/auth/*`; signup leaked raw Supabase errors | `api/routes/auth.py` |
| Whisper hallucination loops | temp 0.0 + trailing-filler-loop guard |
| Stale eye-contact metric mis-flagging everyone | memory rules now use `gaze_center_pct` / brow-lip tension |

## Integration Tests to Write

### `tests/integration/test_pipeline.py`
- Requires a real `.webm` audio fixture + a real `.json` frame fixture
- Run full `run_pipeline()` end-to-end, assert:
  - `RawSignals` is returned with no `None` on acoustic (fixture must be valid audio)
  - `transcript` is non-empty
  - `detected_events` is a list (even if empty)
  - No uncaught exceptions

### `tests/integration/test_whisper.py`
- Send a short known audio clip (e.g. "Hello, my name is Aman")
# PendingTests.md — Pipeline Testing & Improvement Backlog

> Before moving to the stitching/LLM layer, every item below must be addressed.
## Integration Tests to Write

### `tests/integration/test_pipeline.py`
- Requires a real `.webm` audio fixture + a real `.json` frame fixture
- Run full `run_pipeline()` end-to-end, assert:
  - `RawSignals` is returned with no `None` on acoustic (fixture must be valid audio)
  - `transcript` is non-empty
  - `detected_events` is a list (even if empty)
  - No uncaught exceptions

### `tests/integration/test_whisper.py`
- Send a short known audio clip (e.g. "Hello, my name is Aman")
- Assert transcript contains expected words
- Assert `words` list has correct word count
- Test key rotation: intentionally use a bad key first, assert fallback works

---

## Pipeline Improvement Areas

### Visual Event Detection
- [x] Thresholds calibrated via `yt_calibration.py` on 5 reference videos → see `core/visual/Research.md`.
- [x] EMA smoothing (alpha=0.7) applied before all predicates in `event_detection.py`.
- [x] `eye_contact_break < 0.10`, `frown > 0.20`, `smile > 0.60`, `stress > 0.35`, `brow_raise > 0.65`.
- [x] `eye_closure` suppressed when `gazeZone != center` (phone-in-lap false positive fix).
- [ ] **Mocking DISABLED** — re-enable only with `mouthOpenScore < 0.1` AND `> 1000ms` AND score `> 0.85`.

### Whisper / Groq
- [x] `temperature=0.2` → **now 0.0** with a trailing-filler-loop guard (`_strip_trailing_filler_loop` in `clients/groq_client.py`) — Phase 2 DONE (Aug 2026).
- [x] Handle empty `words` list — pipeline WPM math is guarded; scoring treats wpm=0 via duration plumbing. Verified.
- [x] All-keys-exhausted surfaces cleanly — `RuntimeError` caught by the pipeline as a `transcription_failed` warning.

### Linguistics
- [x] `filler_word_ratio` moved into `LinguisticStats` — computed in `linguistics.py`, no longer injected post-pipeline.
- [ ] Test LLM extraction on a transcript with known fillers.
- [ ] Test with empty transcript (should return empty stats, no crash).

### LLM Coach
- [x] JSON parser hardened — regex extracts `{...}` block before `json.loads()`, covering Mistral/Groq preamble edge cases.
- [x] Fast-path report for <10-word transcripts now uses valid `CoachingReport` fields (was crashing with ghost keys) — FIXED Aug 2026.

### Modes
- [x] `impromptu` — full implementation (+ duration-aware silence/pause scoring, golden-value test).
- [ ] `interview` + `presentation` — Phase 4 long-term work. `coaching_rubric()` done; need `compute_score()` + `generate_feedback()`. Frontend gates both behind "Coming Soon", so they are unreachable in beta.

---

## Remaining Threshold Calibration

- [ ] `eye_contact_break` — current value: `eyeContactScore < 0.40`, `400ms`, 2 samples. Record deliberate camera contact and deliberate look-aways.
- [ ] `smile` — current values: `smileScore > 0.45`, `squintScore > 0.15`, `mouthOpenScore < 0.40`, `400ms`, 2 samples. Record genuine smiles and neutral speech.
- [ ] `frown` — current value: `frownScore > 0.40`, `400ms`, 2 samples. Record deliberate frowns and normal speech.
- [ ] `high_stress` — current value: `stressScore > 0.45`, `500ms`, 2 samples. Record deliberate lip-press/stress expressions and neutral speech.

General event rule: every event needs at least **two positive samples** and its
**observed positive span** must meet the duration gate. This prevents a single
sample from being extended to the next frame on slow devices. Current
conservative defaults: `gaze_away` = 800ms; `brow_raise` = `> 0.60` for
500ms; `eye_closure` = `> 0.50` for 500ms. These need validation with
multiple people, cameras, and lighting conditions.

### General Threshold Validation Plan

**Stable general rules — retain unless multi-person testing proves otherwise:**

- [ ] `gaze_away`: require an observed duration of at least 800ms and at least
      2 positive samples. Short natural glances must not create an event.
- [ ] Every visual event: require at least 2 positive samples and use only the
      observed positive span for its duration. A following false frame must not
      extend a short event on a low-FPS device.
- [ ] `eye_closure`: retain the 500ms duration gate; normal blinks should not
      be reported as eye-closure events.
- [ ] No visual event may be created when `faceDetected` is `false`.
- [ ] Keep `brow_raise` as an expression observation. Do not present
      `browInnerUp` as a diagnosis of anxiety.

**Thresholds that need multi-person video evidence before finalising:**

- [ ] `eye_contact_break`: test `< 0.40` for 400ms with deliberate camera
      contact and deliberate left, right, and down look-aways.
- [ ] `eye_closure`: test `blinkScore > 0.50` for 500ms with normal blinking,
      deliberate long eye closure, glasses, and no-glasses recordings.
- [ ] `brow_raise`: test `browInnerUp > 0.60` for 500ms with neutral speech
      and deliberate eyebrow raises. Do not call the result anxiety.
- [ ] `high_stress`: test `stressScore > 0.45` for 500ms with neutral speech
      and deliberate lip-press expressions.
- [ ] `frown`: test `frownScore > 0.40` for 400ms with neutral speech and
      deliberate frowns.
- [ ] `smile`: test `smileScore > 0.45` and `squintScore > 0.15` with genuine
      smiles, talking while smiling, and neutral speech.

**Recording protocol:** collect 30–60 second clips from at least 3 people,
under different lighting and cameras. In each clip, perform one target action
for 1–2 seconds, then return to neutral. Compare detected event timestamps
against the known actions before changing a threshold.

## Long-Recording Support (Required Before 30-Minute Sessions)

### Current limitation

- [x] **RESOLVED (Aug 2026):** a server-side duration ceiling is live — decoded audio longer than
      `max_audio_duration_ms` (default 10 min) is rejected with `413` before Whisper/LLM cost.
- [x] The 50 MB upload cap remains as the first gate; the duration gate is the second.

### Required activation rules (only relevant if the ceiling is ever raised)

- [ ] Above 5 minutes: enable long-recording acoustic mode (lower-resolution
      pitch analysis and chunked processing).
- [ ] Above 8 minutes: split transcription into timestamp-preserving chunks
      with a short overlap, then merge the word timeline.
- [ ] Above 10 minutes: run analysis as a background job with progress; do not
      keep a single HTTP request open while processing.
- [x] Effective supported maximum is now the **10-minute server gate** until
      chunking and background-job support land.

### Implementation and verification

- [ ] Preserve compressed audio for Whisper (WebM or FLAC); do not upload a
      large WAV solely for trailing-silence trimming.
- [ ] Decode once at 16 kHz mono for long-recording acoustic analysis.
- [ ] Merge acoustic events and Whisper word timestamps with the original
      chunk offsets; verify no event or word changes position at a boundary.
- [ ] Test 5-, 8-, 10-, and 30-minute recordings for latency, memory use,
      upload size, transcript completeness, and timeline alignment.

## Manual Verification Checklist (run against real recordings)

1. Record a 60s impromptu session via the frontend
2. Check `logs/vocalyze.log` — every stage must show `✓` or `✗`
3. Check the final `AnalysisResponse` JSON — all fields populated
4. Compare `detected_events` to what you remember doing in the recording
5. Compare `transcript` to what you said
6. Check `wpm` and `articulation_rate` — are they in a realistic range? (100–180 wpm normal)
7. Check `filler_words_found` — did it catch your actual fillers?
8. Check `feedback` list — are tips relevant and non-redundant?
9. Repeat with a deliberately bad session (look away, show anxiety) — score should drop

---

## Known Gaps (not bugs, just not built yet)

| Gap | Impact | When |
|---|---|---|
| `AcousticStats.filler_word_ratio` populated post-linguistics | slight code smell | Low |
| `modes/presentation.py` + `interview.py` raise `NotImplementedError` | blocks those modes | Phase 4 |
