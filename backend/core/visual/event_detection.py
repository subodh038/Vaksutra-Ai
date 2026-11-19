"""
core/visual/event_detection.py — Dense frame timeline → sparse timestamped events.

Converts dense frame timeline into sparse timestamped events (e.g. eye_contact_break) 
for Whisper correlation. See Research.md for threshold citations.
"""

from __future__ import annotations

from typing import Callable, List, Optional

from models.schemas import DetectedEvent, FrameAnalysisEntry


# ── Run-length extractor ─────────────────────────────────────────────────────

def _extract_runs(
    frames: List[FrameAnalysisEntry],
    predicate: Callable[[FrameAnalysisEntry], bool],
    event_type: str,
    min_duration_ms: float,
    value_fn: Optional[Callable[[FrameAnalysisEntry], float]] = None,
    min_consecutive_frames: int = 2,
) -> List[DetectedEvent]:
    """
    Generic run-length extractor.

    Walks frames in order. While `predicate` stays True we're "inside" a run.
    The moment it turns False (or frames end), the run closes — and we only
    keep it if it lasted at least `min_duration_ms` (debounce).

    `value_fn`, if given, tracks the worst/highest value seen during the run
    (e.g. lowest eye-contact score, highest brow raise) so the event carries
    severity info, not just "it happened".
    """
    events: List[DetectedEvent] = []
    run_start: Optional[float] = None
    run_last_true_ts: Optional[float] = None
    run_peak: float = 0.0
    run_frame_count = 0

    def close_run() -> None:
        nonlocal run_start, run_last_true_ts, run_peak, run_frame_count
        if run_start is None or run_last_true_ts is None:
            return
        # Use only the span actually observed to satisfy the predicate. Using
        # the next false frame can turn one short sample into a long event
        # when a device samples sparsely.
        duration = run_last_true_ts - run_start
        if duration >= min_duration_ms and run_frame_count >= min_consecutive_frames:
            events.append(
                DetectedEvent(
                    type=event_type,
                    start_ms=run_start,
                    end_ms=run_last_true_ts,
                    duration_ms=round(duration, 1),
                    peak_value=round(run_peak, 4) if value_fn else None,
                )
            )
        run_start = None
        run_last_true_ts = None
        run_peak = 0.0
        run_frame_count = 0

    for f in frames:
        if predicate(f):
            if run_start is None:
                run_start = f.timestamp
                run_peak = value_fn(f) if value_fn else 0.0
                run_frame_count = 1
                run_last_true_ts = f.timestamp
            elif value_fn:
                run_peak = max(run_peak, value_fn(f))
                run_frame_count += 1
                run_last_true_ts = f.timestamp
            else:
                run_frame_count += 1
                run_last_true_ts = f.timestamp
        else:
            close_run()

    if frames:
        close_run()

    return events


# ── Public entry point ────────────────────────────────────────────────────────

def detect_events(frames: List[FrameAnalysisEntry]) -> List[DetectedEvent]:
    """
    Convert a dense per-frame MediaPipe timeline into a sparse list of
    notable timestamped events. Returns events sorted by start_ms.
    """
    if not frames:
        return []

    frames = sorted(frames, key=lambda f: f.timestamp)

    # ── Apply EMA Smoothing ──
    smoothed_frames = []
    alpha = 0.7
    ema = {}

    for f in frames:
        new_f = f.model_copy()
        
        for key in ["eyeContactScore", "frownScore", "smileScore", "browRaiseScore", "cheekSquintScore", "stressScore", "blinkScore"]:
            val = getattr(new_f, key, 0.0)
            if key not in ema:
                ema[key] = val
            else:
                ema[key] = alpha * val + (1.0 - alpha) * ema[key]
            
            setattr(new_f, key, ema[key])
            
        smoothed_frames.append(new_f)

    frames = smoothed_frames

    events: List[DetectedEvent] = []

    # eye_contact_break — eyeContactScore < 0.10, 400ms
    events += _extract_runs(
        frames,
        predicate=lambda f: f.faceDetected and f.eyeContactScore < 0.10,
        event_type="eye_contact_break",
        min_duration_ms=400,
        value_fn=lambda f: 1 - f.eyeContactScore,
    )

    # gaze_away — sustained non-center zone. 800ms matches the research-backed
    # disengagement threshold and avoids flagging brief natural glances.
    events += _extract_runs(
        frames,
        predicate=lambda f: f.faceDetected and f.gazeZone != "center",
        event_type="gaze_away",
        min_duration_ms=800,
    )

    # brow_raise — browInnerUp is an expression coefficient (AU1), not an
    # anxiety classifier. Keep this observation separate from any later
    # coaching interpretation and require a marked, sustained activation.
    events += _extract_runs(
        frames,
        predicate=lambda f: f.faceDetected and f.browRaiseScore > 0.65,
        event_type="brow_raise",
        min_duration_ms=500,
        value_fn=lambda f: f.browRaiseScore,
    )

    # frown — mouthFrown (FACS AU15) > 0.20, 400ms
    events += _extract_runs(
        frames,
        predicate=lambda f: f.faceDetected and f.frownScore > 0.20,
        event_type="frown",
        min_duration_ms=400,
        value_fn=lambda f: f.frownScore,
    )

    # mocking — DISABLED: mockingScore blendshapes (mouthPucker, mouthShrugLower) activate
    # naturally during normal speech. Even at threshold=0.75 it produced 11 false positives
    # on a normal recording. Re-enable only after building a composite signal that also
    # requires absence of speech (mouthOpenScore near 0) and sustained duration (>1s).
    # events += _extract_runs(
    #     frames,
    #     predicate=lambda f: f.faceDetected and f.mockingScore > 0.75,
    #     event_type="mocking",
    #     min_duration_ms=500,
    #     value_fn=lambda f: f.mockingScore,
    # )

    # high_stress — mouthPress (FACS AU20) > 0.35, 500ms
    events += _extract_runs(
        frames,
        predicate=lambda f: f.faceDetected and f.stressScore > 0.35,
        event_type="high_stress",
        min_duration_ms=500,
        value_fn=lambda f: f.stressScore,
    )

    # smile — mouthSmile (AU12) avg > 0.30, Duchenne guard (AU6 cheek raise
    # OR lid squint), jaw guard < 0.4 (AU27), 400ms.
    # NOTE: smileScore switched from sum to per-side average on the frontend —
    # a genuine smile sits ≈ 0.4-0.8 avg, so the old 0.60-sum gate (~0.30 avg)
    # is preserved as 0.30-avg.
    # Guard against grimacing/crying which raises smile alongside brow/stress.
    events += _extract_runs(
        frames,
        predicate=lambda f: (
            f.faceDetected
            and f.smileScore         > 0.30
            and (f.squintScore > 0.15 or f.cheekSquintScore > 0.05)  # Duchenne: AU44 lid or AU6 cheek
            and f.mouthOpenScore < 0.4
            and f.browRaiseScore     < 0.4
            and f.stressScore        < 0.4
        ),
        event_type="smile",
        min_duration_ms=400,
        value_fn=lambda f: f.smileScore,
    )

    # eye_closure — duration plus the shared two-sample rule rejects a normal
    # blink without assuming a particular camera frame rate.
    # Note: Suppressed when looking away to avoid false positives when looking down at notes/phone
    events += _extract_runs(
        frames,
        predicate=lambda f: f.faceDetected and f.blinkScore > 0.50 and f.gazeZone == "center",
        event_type="eye_closure",
        min_duration_ms=500,
        value_fn=lambda f: f.blinkScore,
    )

    events.sort(key=lambda e: e.start_ms)
    return events
