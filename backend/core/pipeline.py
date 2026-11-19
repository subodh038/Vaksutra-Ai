"""
core/pipeline.py — Mode-agnostic analysis pipeline for the Vocalyze AI Backend.

Orchestrates five sequential stages for every request:
  1. Visual analysis   — gaze, emotion, head-pose stats + score ranges.
  2. Event detection   — dense frame array → sparse timestamped events.
  3. Acoustic analysis — ffmpeg decode → librosa pitch / volume / pauses.
  4. Whisper           — Groq whisper-large-v3 transcription (async).
  5. Linguistics       — hybrid Python regex + Groq LLM coaching analysis.

Returns
-------
RawSignals — mode-agnostic signal bundle.
The active coaching mode (BaseMode) then interprets RawSignals into a score + feedback.

Public API
----------
  run_pipeline()  → RawSignals         (pipeline only — useful for testing)
  run_analysis()  → AnalysisResponse   (pipeline + mode + response assembly)

Logging convention
------------------
  INFO  : stage start ▶, stage result ✓/✗, final summary table
  DEBUG : per-stage computed values (scores, word counts, transcript text, etc.)
"""

from __future__ import annotations

import logging
import time
import asyncio
from pathlib import Path
from typing import List

from models.schemas import (
    AnalysisResponse,
    AcousticStats,
    DetectedEvent,
    FrameAnalysisPayload,
    LinguisticStats,
    PipelineStatus,
    RawSignals,
    DerivedInsights,
)
from config import get_settings
from core.visual.gaze import gaze_breakdown
from core.insights.insight_generator import generate_derived_insights
from core.visual.emotion import emotion_summary
from core.visual.head_pose import head_pose_summary, score_ranges
from core.visual.event_detection import detect_events
from core.acoustic.waveform_analyzer import WaveformAnalyzer
from core.linguistic.linguistics import analyze_linguistics
from core.stitching.stitcher import stitch_pipeline_data
from clients.groq_client import transcribe_audio
from modes.base import BaseMode
from services.llm_coach import generate_coaching_report

logger = logging.getLogger(__name__)

# ── Helpers ───────────────────────────────────────────────────────────────────

_PASS = "✓"
_FAIL = "✗"
_RUN  = "▶"


def _ms(seconds: float) -> str:
    """Format a perf_counter duration as a human-readable string."""
    if seconds < 1:
        return f"{seconds * 1000:.1f}ms"
    return f"{seconds:.3f}s"


# ── Pipeline (mode-agnostic) ─────────────────────────────────────────────────

async def run_pipeline(
    audio_bytes: bytes,
    audio_filename: str,
    payload: FrameAnalysisPayload,
) -> RawSignals:
    """
    Run the full analysis pipeline and return raw signals.

    Parameters
    ----------
    audio_bytes   : Raw bytes of the WebM audio blob.
    audio_filename: Original filename from the multipart upload.
    payload       : Validated FrameAnalysisPayload from the frontend.

    Returns
    -------
    RawSignals — mode-agnostic bundle passed to the active coaching mode.
    """
    t_total = time.perf_counter()

    frames      = payload.frameAnalysis
    face_frames = [f for f in frames if f.faceDetected]
    face_detected_pct = round(len(face_frames) / len(frames) * 100, 1) if frames else 0.0

    # Timing register — filled in as each stage completes
    stage_times: dict[str, float] = {}
    pipeline_warnings: list[str] = []

    logger.info(
        "━━━ Pipeline start ━━━  frames=%d  face_frames=%d (%.1f%%)  audio=%d bytes",
        len(frames), len(face_frames), face_detected_pct, len(audio_bytes),
    )

    # ── Stage 1: Visual analysis ──────────────────────────────────────────────
    logger.info("%s Stage 1/5 — Visual analysis", _RUN)
    t0 = time.perf_counter()

    gaze    = gaze_breakdown(frames)
    emotion = emotion_summary(face_frames)
    hp      = head_pose_summary(face_frames)
    ranges  = score_ranges(face_frames)

    stage_times["visual"] = time.perf_counter() - t0
    logger.info("%s Stage 1/5 — Visual analysis          %s", _PASS, _ms(stage_times["visual"]))
    logger.debug(
        "  gaze:      center=%.1f%%  left=%.1f%%  right=%.1f%%  down=%.1f%%  away=%.1f%%",
        gaze.center_pct, gaze.left_pct, gaze.right_pct, gaze.down_pct, gaze.away_pct,
    )
    logger.debug(
        "  blendshapes: brow_raise=%.3f  stress=%.3f  confusion=%.3f  smile=%.3f  blink=%.3f",
        emotion.avg_brow_raise, emotion.avg_stress, emotion.avg_confusion,
        emotion.avg_smile, emotion.avg_blink_rate,
    )
    logger.debug(
        "  head_pose: eye_contact=%.3f  head_pose=%.3f  pitch=%.3f  roll=%.3f",
        hp.avg_eye_contact, hp.avg_head_pose, hp.avg_head_pitch, hp.avg_head_roll,
    )

    # ── Stage 2: Event detection ──────────────────────────────────────────────
    logger.info("%s Stage 2/5 — Event detection", _RUN)
    t0 = time.perf_counter()
    detected_events: List[DetectedEvent] = []

    try:
        detected_events = detect_events(frames)
        stage_times["events"] = time.perf_counter() - t0
        logger.info(
            "%s Stage 2/5 — Event detection             %s  (%d events)",
            _PASS, _ms(stage_times["events"]), len(detected_events),
        )
        if detected_events:
            by_type: dict[str, int] = {}
            for e in detected_events:
                by_type[e.type] = by_type.get(e.type, 0) + 1
            logger.info("  event breakdown: %s", by_type)
    except Exception as exc:
        stage_times["events"] = time.perf_counter() - t0
        logger.error(
            "%s Stage 2/5 — Event detection             %s  FAILED: %s",
            _FAIL, _ms(stage_times["events"]), exc, exc_info=True,
        )
        pipeline_warnings.append("event_detection_failed")

    # ── Stage 3: Acoustic analysis ────────────────────────────────────────────
    logger.info("%s Stage 3/5 — Acoustic analysis  (%d bytes)", _RUN, len(audio_bytes))
    t0 = time.perf_counter()
    acoustic_dict: dict = {}
    waveform: WaveformAnalyzer | None = None

    try:
        waveform      = WaveformAnalyzer(audio_bytes)
        # Offload heavy CPU math to a background thread to prevent blocking the asyncio event loop
        acoustic_dict, pauses = await asyncio.to_thread(waveform.summarize)
        
        # Add pauses to the main event timeline for the frontend
        # We filter to > 1000ms here so we don't clutter the UI with hundreds of 300ms micro-pauses.
        # (The full list of 300ms+ pauses is still used for the AcousticStats math).
        for p in pauses:
            if p["duration_ms"] >= 1000:
                detected_events.append(
                    DetectedEvent(
                        type="long pause",
                        start_ms=p["start_ms"],
                        end_ms=p["end_ms"],
                        duration_ms=p["duration_ms"]
                    )
                )
        
        # Sort events chronologically since we just appended acoustic events after visual ones
        detected_events.sort(key=lambda e: e.start_ms)
        stage_times["acoustic"] = time.perf_counter() - t0
        logger.info(
            "%s Stage 3/5 — Acoustic analysis           %s",
            _PASS, _ms(stage_times["acoustic"]),
        )
        logger.debug(
            "  pitch_variation=%.3f  avg_volume=%.4f  pause_count=%d  "
            "longest_pause=%.0fms  total_pause=%.0fms",
            acoustic_dict["pitch_variation"],
            acoustic_dict["avg_volume"],
            acoustic_dict["pause_count"],
            acoustic_dict["longest_pause_ms"],
            acoustic_dict["total_pause_time_ms"],
        )
    except Exception as exc:
        stage_times["acoustic"] = time.perf_counter() - t0
        err_msg = str(exc).lower()
        hint = "\n[HINT] Check if ffmpeg is installed on the server." if "ffmpeg" in err_msg or "ffprobe" in err_msg else ""
        logger.error(
            "%s Stage 3/5 — Acoustic analysis           %s  FAILED: %s%s",
            _FAIL, _ms(stage_times["acoustic"]), exc, hint, exc_info=True,
        )
        pipeline_warnings.append("acoustic_analysis_failed")

    # ── Session duration — single source of truth for every downstream stage ──
    # Frames carry MediaPipe timestamps; when the frontend sent none
    # (audio-only fallback), fall back to the decoded audio length.
    if frames:
        # Frames may arrive unordered from the client — trust the MAX
        # timestamp, not the last element, or shuffled payloads yield a
        # near-zero duration and wildly inflated WPM/silence metrics.
        session_duration_ms = float(max(f.timestamp for f in frames))
        if session_duration_ms < 0:
            session_duration_ms = 0.0
        duration_source = "frames"
    else:
        session_duration_ms = float(acoustic_dict.get("duration_ms", 0.0))
        duration_source = "audio-decode"
    logger.info(
        "Session duration: %.0fms (source=%s)",
        session_duration_ms, duration_source,
    )

    # ── Server-side duration ceiling ──────────────────────────────────────────
    # The 50 MB size cap alone allows ~10+ min of Opus audio; reject long
    # recordings BEFORE paying for Whisper + LLM stages.
    max_dur = get_settings().max_audio_duration_ms
    if session_duration_ms > max_dur:
        logger.warning(
            "Recording rejected: %.1f min exceeds %.0f min cap.",
            session_duration_ms / 60_000, max_dur / 60_000,
        )
        from fastapi import HTTPException
        raise HTTPException(
            status_code=413,
            detail=(
                f"Recording too long ({session_duration_ms / 60000:.1f} min). "
                f"Maximum supported: {max_dur / 60000:.0f} minutes."
            ),
        )

    # ── Stage 4: Whisper transcription ────────────────────────────────────────
    logger.info("%s Stage 4/5 — Whisper transcription  (%s audio)", _RUN, audio_filename)
    t0 = time.perf_counter()
    transcript_data: dict = {"text": "", "words": []}

    try:
        audio_for_transcription = audio_bytes
        transcription_filename = audio_filename
        if waveform is not None:
            # Trailing-only trim preserves the shared t=0 used by frame events.
            audio_for_transcription = await asyncio.to_thread(waveform.get_trimmed_audio_bytes)
            transcription_filename = f"{Path(audio_filename).stem}.wav"
        transcript_data = await transcribe_audio(audio_for_transcription, transcription_filename)
        stage_times["whisper"] = time.perf_counter() - t0
        word_list = transcript_data.get("words", [])
        logger.info(
            "%s Stage 4/5 — Whisper transcription       %s  (%d words)",
            _PASS, _ms(stage_times["whisper"]), len(word_list),
        )
        # Transcript text is PII — keep it out of INFO-level log files.
        logger.debug("=" * 80)
        logger.debug("RAW TRANSCRIPT (FROM WHISPER):")
        logger.debug(transcript_data["text"])
        logger.debug("=" * 80)
    except Exception as exc:
        stage_times["whisper"] = time.perf_counter() - t0
        err_msg = str(exc).lower()
        hint = ""
        if "401" in err_msg or "unauthorized" in err_msg:
            hint = "\n[HINT] Invalid GROQ API key or unauthorized. Check your GROQ_API_KEYS variable."
        elif "429" in err_msg or "rate limit" in err_msg:
            hint = "\n[HINT] Hit Groq API rate limit. Please try again later."
        logger.error(
            "%s Stage 4/5 — Whisper transcription       %s  FAILED: %s%s",
            _FAIL, _ms(stage_times["whisper"]), exc, hint, exc_info=True,
        )
        pipeline_warnings.append("transcription_failed")

    # ── Stage 4.5: Stitching (Word-to-Event Correlation) ──────────────────────
    t0_stitch = time.perf_counter()
    transcript_data, detected_events, stitched_timeline = stitch_pipeline_data(
        transcript_data,
        detected_events,
        duration_ms=session_duration_ms,
    )
    logger.debug("  stitching complete: %s", _ms(time.perf_counter() - t0_stitch))
    if stitched_timeline.marked_text:
        logger.debug("=" * 80)
        logger.debug("FINAL STITCHED TRANSCRIPT (WITH EVENTS):")
        logger.debug(stitched_timeline.marked_text)
        logger.debug("=" * 80)

    # ── Stage 4b: Speech-rate metrics ─────────────────────────────────────────
    # Works for BOTH normal and audio-only sessions — duration now comes from
    # the session-level value instead of frames[-1].timestamp.
    if acoustic_dict:
        words        = transcript_data.get("words", [])
        word_count   = len(words)
        duration_min = session_duration_ms / 60_000.0
        wpm          = word_count / duration_min if duration_min > 0 else 0.0
        # Calculate ground-truth active speech duration from Whisper word boundaries
        if words and len(words) > 0:
            speech_spans = []
            c_start = words[0]["start"] * 1000.0
            c_end = words[0]["end"] * 1000.0
            for w in words[1:]:
                w_start = w["start"] * 1000.0
                w_end = w["end"] * 1000.0
                if w_start - c_end <= 600.0:  # natural conversational word spacing
                    c_end = max(c_end, w_end)
                else:
                    speech_spans.append((c_start, c_end))
                    c_start = w_start
                    c_end = w_end
            speech_spans.append((c_start, c_end))
            active_ms = min(session_duration_ms, max(0.0, sum(e - s for s, e in speech_spans)))
        else:
            active_ms = max(0.0, session_duration_ms - acoustic_dict.get("total_pause_time_ms", 0))

        active_min   = active_ms / 60_000.0
        articulation_rate = word_count / active_min if active_min > 0 else 0.0
        acoustic_dict["wpm"]               = wpm
        acoustic_dict["articulation_rate"] = articulation_rate
        logger.info(
            "Speech rate: duration=%.1fs  words=%d  wpm=%.1f  articulation=%.1f",
            session_duration_ms / 1000, word_count, wpm, articulation_rate,
        )

    # ── Stage 5: Linguistic analysis ──────────────────────────────────────────
    logger.info("%s Stage 5/5 — Linguistic analysis", _RUN)
    t0 = time.perf_counter()
    linguistic_stats: LinguisticStats

    try:
        linguistic_stats = await analyze_linguistics(
            transcript_data.get("text", ""),
            transcript_data.get("words", []),
        )
        stage_times["linguistic"] = time.perf_counter() - t0
        logger.info(
            "%s Stage 5/5 — Linguistic analysis         %s",
            _PASS, _ms(stage_times["linguistic"]),
        )
        logger.debug(
            "  weak_words=%d  fillers=%d  run_on_sentences=%d  repeated_words=%s",
            linguistic_stats.weak_words_count,
            len(linguistic_stats.filler_words_found),
            linguistic_stats.run_on_sentences,
            linguistic_stats.top_repeated_words,
        )
        if linguistic_stats.filler_words_found:
            logger.debug("  fillers found: %s", linguistic_stats.filler_words_found)
        if linguistic_stats.weak_words_found:
            logger.debug("  weak words:   %s", linguistic_stats.weak_words_found)
    except Exception as exc:
        stage_times["linguistic"] = time.perf_counter() - t0
        logger.error(
            "%s Stage 5/5 — Linguistic analysis         %s  FAILED: %s\n[HINT] The LLM failed to analyze linguistics, possibly due to rate limits or invalid GROQ/MISTRAL keys.",
            _FAIL, _ms(stage_times["linguistic"]), exc, exc_info=True,
        )
        linguistic_stats = LinguisticStats(
            weak_words_count=0, weak_words_found=[],
            run_on_sentences=0, top_repeated_words=[], filler_words_found=[],
        )
        pipeline_warnings.append("linguistic_analysis_failed")

    # ── Filler ratio — now owned by LinguisticStats (computed in linguistics.py) ──
    filler_ratio = linguistic_stats.filler_word_ratio
    filler_count = len(linguistic_stats.filler_words_found)
    if acoustic_dict:
        acoustic_dict["filler_word_ratio"] = filler_ratio  # keep AcousticStats in sync for LLM context
    logger.debug(
        "  filler ratio: %.1f%%  (%d fillers / %d words)",
        filler_ratio * 100, filler_count, len(transcript_data.get("words", [])),
    )

    # ── AcousticStats model ───────────────────────────────────────────────────
    # duration_ms is an internal pipeline key — strip it before model validation.
    _acoustic_stats_model: AcousticStats | None = None
    if acoustic_dict:
        _acoustic_only = {k: v for k, v in acoustic_dict.items() if k != "duration_ms"}
        _acoustic_stats_model = AcousticStats(**_acoustic_only)

    # ── Pipeline summary ──────────────────────────────────────────────────────
    total_s = time.perf_counter() - t_total
    logger.info(
        "━━━ Pipeline complete ━━━  total=%s\n"
        "    Stage 1 visual      %s\n"
        "    Stage 2 events      %s\n"
        "    Stage 3 acoustic    %s\n"
        "    Stage 4 whisper     %s\n"
        "    Stage 5 linguistic  %s",
        _ms(total_s),
        _ms(stage_times.get("visual",    0)),
        _ms(stage_times.get("events",    0)),
        _ms(stage_times.get("acoustic",  0)),
        _ms(stage_times.get("whisper",   0)),
        _ms(stage_times.get("linguistic",0)),
    )

    return RawSignals(
        frames=              frames,
        face_frames=         face_frames,
        face_detected_pct=   face_detected_pct,
        gaze=                gaze,
        emotion=             emotion,
        head_pose=          hp,
        acoustic_stats=      _acoustic_stats_model,
        linguistic_stats=    linguistic_stats,
        detected_events=     detected_events,
        score_ranges=        ranges,
        transcript=          transcript_data["text"],
        audio_received_bytes=len(audio_bytes),
        duration_ms=         session_duration_ms,
        stitched_timeline=   stitched_timeline,
        pipeline_status=     PipelineStatus(
            is_partial=bool(pipeline_warnings),
            warnings=pipeline_warnings,
        ),
    )


# ── Full analysis (pipeline + mode) ──────────────────────────────────────────

async def run_analysis(
    audio_bytes: bytes,
    audio_content_type: str,
    audio_filename: str,
    payload: FrameAnalysisPayload,
    mode: BaseMode,
) -> tuple[AnalysisResponse, RawSignals]:
    """
    Full analysis: pipeline → mode scoring → AnalysisResponse.
    Called by api/routes/analysis.py.

    Parameters
    ----------
    audio_bytes        : Raw audio blob bytes.
    audio_content_type : MIME type (audio/webm).
    audio_filename     : Original filename from multipart upload.
    payload            : Validated FrameAnalysisPayload.
    mode               : Active BaseMode instance from MODE_REGISTRY.
    """
    t0 = time.perf_counter()
    logger.info("▶ run_analysis  mode=%s", mode.mode_id)

    signals = await run_pipeline(audio_bytes, audio_filename, payload)

    logger.info("%s Scoring  mode=%s", _RUN, mode.mode_id)
    t_score = time.perf_counter()
    score    = mode.compute_score(signals)
    feedback = mode.generate_feedback(signals, score)
    logger.info(
        "%s Scoring done  score=%.1f  tips=%d  %s",
        _PASS, score, len(feedback), _ms(time.perf_counter() - t_score),
    )

    logger.info(
        "✅ Scoring complete  mode=%s  score=%.1f  total=%s",
        mode.mode_id, score, _ms(time.perf_counter() - t0),
    )

    # Decoupled LLM Report: Background task handles this to prevent UI blocking.
    coaching_report = None

    # Attach UI insights to signals so the background LLM stays in sync with frontend stats.
    insights = generate_derived_insights(signals)
    signals = signals.model_copy(update={"insights": insights})

    logger.info(
        "✅ Request complete  mode=%s  score=%.1f  total=%s",
        mode.mode_id, score, _ms(time.perf_counter() - t0),
    )

    response = AnalysisResponse(
        audio_received_bytes=signals.audio_received_bytes,
        frame_count=         len(signals.frames),
        face_detected_pct=   signals.face_detected_pct,
        gaze=                signals.gaze,
        emotion=             signals.emotion,
        head_pose=           signals.head_pose,
        acoustic_stats=      signals.acoustic_stats,
        linguistic_stats=    signals.linguistic_stats,
        overall_score=       score,
        feedback=            feedback,
        detected_events=     signals.detected_events,
        score_ranges=        signals.score_ranges,
        transcript=          signals.transcript,
        stitched_timeline=   signals.stitched_timeline,
        pipeline_status=     signals.pipeline_status,
        insights=            insights,
        coaching_report=     coaching_report,
    )
    return response, signals
