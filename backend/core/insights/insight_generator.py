from models.schemas import DerivedInsights, RawSignals

def generate_derived_insights(signals: RawSignals) -> DerivedInsights:
    """
    Calculates speaker-friendly metrics from the deterministic raw signals.
    Extracted from pipeline to adhere to Single Responsibility Principle (SRP).
    """
    # Session-level duration (frames or decoded audio) — never derive from
    # frames directly here, audio-only sessions would get 0.
    duration_ms = signals.duration_ms

    # Pacing Status
    wpm = signals.acoustic_stats.wpm if signals.acoustic_stats else 0.0
    if wpm < 110:
        pacing_status = "Sluggish"
    elif wpm > 150:
        pacing_status = "Rushed"
    else:
        pacing_status = "Conversational"

    # Vocal Variety
    pitch_var = signals.acoustic_stats.pitch_variation if signals.acoustic_stats else 0.0
    if pitch_var < 20.0:
        vocal_variety = "Monotone"
    elif pitch_var > 40.0:
        vocal_variety = "Highly Expressive"
    else:
        vocal_variety = "Dynamic"

    # Silence Ratio: derive from ground-truth spoken word boundaries if available
    if signals.stitched_timeline is not None:
        words = signals.stitched_timeline.transcript_timeline
        if words and len(words) > 0 and duration_ms > 0:
            speech_spans = []
            c_start = words[0].start_ms
            c_end = words[0].end_ms
            for w in words[1:]:
                if w.start_ms - c_end <= 600.0:  # natural conversational word spacing
                    c_end = max(c_end, w.end_ms)
                else:
                    speech_spans.append((c_start, c_end))
                    c_start = w.start_ms
                    c_end = w.end_ms
            speech_spans.append((c_start, c_end))
            active_speech_ms = sum(e - s for s, e in speech_spans)
            silence_ms = max(0.0, duration_ms - active_speech_ms)
            silence_ratio_pct = (silence_ms / duration_ms) * 100.0
        else:
            silence_ratio_pct = 100.0 if duration_ms > 0 else 0.0
    else:
        total_pause = signals.acoustic_stats.total_pause_time_ms if signals.acoustic_stats else 0.0
        silence_ratio_pct = (total_pause / duration_ms * 100.0) if duration_ms > 0 else 0.0

    # Audience Connection
    # gaze.center_pct only. The previous blend with head_pose.avg_eye_contact
    # dragged this down — that metric is MediaPipe-capped at ~0.55-0.60
    # regardless of actual gaze quality.
    audience_connection_pct = signals.gaze.center_pct
    
    # Warmth Index — PROVISIONAL bands for the AVG smile scale; no external
    # source exists for blendshape smile cut-offs. Recalibrate from beta data.
    avg_smile = signals.emotion.avg_smile
    if avg_smile >= 0.30:
        warmth_index = "Radiant"
    elif avg_smile >= 0.12:
        warmth_index = "Approachable"
    else:
        warmth_index = "Serious"
        
    # Composure Index (brow raise + lip press — observable tension, not emotion)
    avg_brow = signals.emotion.avg_brow_raise
    avg_stress = signals.emotion.avg_stress
    composure_score = avg_brow + avg_stress
    if composure_score > 0.40:
        composure_index = "Nervous"
    elif composure_score > 0.20:
        composure_index = "Tense"
    else:
        composure_index = "Composed"
    
    # Fidget Index
    restless_events = sum(1 for e in signals.detected_events if e.type in ("gaze_away", "eye_contact_break"))
    duration_min = duration_ms / 60000.0 if duration_ms > 0 else 0.1
    fidget_rate = restless_events / duration_min
    fidget_index = "Restless" if fidget_rate > 5 else "Calm"
    
    # Filler Severity
    filler_pct = signals.acoustic_stats.filler_word_ratio * 100.0 if signals.acoustic_stats else 0.0
    if filler_pct < 3.0:
        filler_severity = "Clean"
    elif filler_pct > 8.0:
        filler_severity = "Distracting"
    else:
        filler_severity = "Noticeable"

    return DerivedInsights(
        pacing_status=pacing_status,
        pacing_wpm=round(wpm, 1),
        vocal_variety=vocal_variety,
        vocal_pitch_var=round(pitch_var, 1),
        silence_ratio_pct=round(silence_ratio_pct, 1),
        audience_connection_pct=round(audience_connection_pct, 1),
        warmth_index=warmth_index,
        warmth_smile_pct=round(avg_smile * 100.0, 1),
        composure_index=composure_index,
        composure_anxiety_stress_pct=round(composure_score * 100.0, 1),
        fidget_index=fidget_index,
        fidget_count=restless_events,
        filler_severity=filler_severity,
        filler_pct=round(filler_pct, 1),
    )
