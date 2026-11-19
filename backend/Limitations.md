# Vocalyze AI Backend — System Limitations & Future Fixes

_Updated August 2026. Items marked ✅ are resolved; kept for context._

## 1. Groq API File Size Limit (25 MB) — ⚠️ bounded

- A 1-minute WebM audio file is roughly 1 MB; a 15-minute presentation ~15 MB fits a single request.
- **NEW (Aug 2026):** the pipeline now enforces a server-side `max_audio_duration_ms` ceiling (default **10 minutes**) and rejects longer recordings with `413` *before* decoding cost is wasted on Whisper. Combined with the 50 MB upload cap, the direct-upload limit cannot be hit in practice.
- **Future Fix** if the cap is ever raised: timestamp-preserving audio chunking with overlap-merge (see Backlog → Long-Recording Support).

## 2. Whisper Hallucination Loops — ✅ RESOLVED (Aug 2026)

Three independent layers now prevent the endless `"uh, uh, uh"` loop on trailing silence:
1. **Trailing-silence trim** before upload (`waveform_analyzer.get_trimmed_audio_bytes`, preserves shared t=0).
2. **`temperature=0.0`** on all transcription calls.
3. **Post-transcription loop guard** (`groq_client._strip_trailing_filler_loop`) — detects a ≥6-token pure-filler tail run, strips it from both text and word timeline, logs a warning.

If loops ever reappear in a new form, extend `_LOOP_FILLERS` / lower `_MIN_LOOP_RUN`.

## 3. Whisper "Prompt Drift" on Long Audio — still open, now bounded

The verbatim filler prompt may lose influence past ~minute 12 of continuous audio.
- With the 10-minute ceiling this is currently unreachable.
- If sessions get longer: split into ~3-minute chunks transcribed in parallel, offsetting word timestamps by each chunk's start (`+180s`) before stitching.
