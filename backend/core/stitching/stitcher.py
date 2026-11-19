import logging
from typing import Any, Dict, List, Tuple

from models.schemas import DetectedEvent, StitchedTimeline, TimestampedWord

logger = logging.getLogger(__name__)

def stitch_pipeline_data(
    transcript_data: Dict[str, Any],
    detected_events: List[DetectedEvent],
    duration_ms: float = 0.0,
) -> Tuple[Dict[str, Any], List[DetectedEvent], StitchedTimeline]:
    """
    Correlates Whisper words with visual/acoustic events.
    1. Removes any hallucinated words that fall entirely within a 'long pause'.
    2. Attaches 'spoken_text' to all remaining events by finding overlapping words.
    
    transcript_data: {"text": str, "words": [{"word": str, "start": float, "end": float}]}
    detected_events: List of DetectedEvent objects.
    """
    words = transcript_data.get("words", [])
    logger.info(
        "Stitcher input: %d words, %d events (%d long pauses)",
        len(words), len(detected_events), sum(1 for e in detected_events if e.type == "long pause"),
    )
    if not words:
        logger.warning("Stitcher received no words — returning empty timeline.")
        return transcript_data, detected_events, StitchedTimeline(
            duration_ms=duration_ms,
            visual_events=[event for event in detected_events if event.type != "long pause"],
            acoustic_pauses=[event for event in detected_events if event.type == "long pause"],
        )

    # Diagnostic: log non-monotonic timestamps (Whisper bug) to trace token-sorting issues (see Research.md §14).
    for i in range(1, len(words)):
        prev_end = words[i - 1].get("end", 0.0)
        curr_start = words[i].get("start", 0.0)
        if curr_start < prev_end:
            logger.warning(
                "Non-monotonic Whisper timestamps: '%s' (ends %.3fs) then '%s' (starts %.3fs) — overlap %.3fs",
                words[i - 1].get("word", "").strip(), prev_end,
                words[i].get("word", "").strip(), curr_start,
                prev_end - curr_start,
            )

    # 1. Hallucination Filtering
    long_pauses = [e for e in detected_events if e.type == "long pause"]
    valid_words = []
    
    for w in words:
        w_start_ms = w.get("start", 0.0) * 1000
        w_end_ms = w.get("end", 0.0) * 1000
        
        is_hallucination = False
        for pause in long_pauses:
            # If the word is COMPLETELY inside the pause, it's a hallucination
            if w_start_ms >= pause.start_ms and w_end_ms <= pause.end_ms:
                is_hallucination = True
                logger.debug(
                    "Filtered hallucinated word '%s' inside pause (%.0fms - %.0fms)", 
                    w.get('word', '').strip(), pause.start_ms, pause.end_ms
                )
                break
                
        if not is_hallucination:
            valid_words.append(w)
            
    # Rebuild transcript text from valid words (if any were filtered)
    if len(valid_words) < len(words):
        transcript_data["words"] = valid_words
        transcript_data["text"] = " ".join(w.get("word", "").strip() for w in valid_words if w.get("word", "").strip())
        logger.info("Stitcher filtered %d hallucinated words.", len(words) - len(valid_words))
    else:
        logger.info("Stitcher: no hallucinated words found (%d words all kept).", len(valid_words))
        
    # 2. Event Correlation
    for event in detected_events:
        overlapping_words = []
        for w in valid_words:
            w_start_ms = w.get("start", 0.0) * 1000
            w_end_ms = w.get("end", 0.0) * 1000
            
            # Check for overlap: word starts before event ends, and word ends after event starts
            if w_start_ms < event.end_ms and w_end_ms > event.start_ms:
                word_str = w.get("word", "").strip()
                if word_str:
                    overlapping_words.append(word_str)
                    
        if overlapping_words and event.type != "long pause":
            event.spoken_text = " ".join(overlapping_words)
        else:
            event.spoken_text = ""
            
    logger.info(
        "Stitcher event correlation: %d/%d events matched to spoken text",
        sum(1 for e in detected_events if e.spoken_text), len(detected_events),
    )

    # 3. Generate Marked Transcript
    # Built directly in original Whisper order (immune to timestamp jitter).
    timestamped_words = [
        TimestampedWord(
            word=w.get("word", "").strip(),
            start_ms=w.get("start", 0.0) * 1000,
            end_ms=w.get("end", 0.0) * 1000,
        )
        for w in valid_words
        if w.get("word", "").strip()
    ]

    # Merge word tokens with event markers. Walk words in original Whisper order
    # and only use timestamps to insert markers. (Fixes non-monotonic timestamp bug).
    sorted_events = sorted(detected_events, key=lambda e: e.start_ms)
    tokens: List[str] = []
    event_idx = 0
    for w in valid_words:
        w_start_ms = w.get("start", 0.0) * 1000
        while event_idx < len(sorted_events) and sorted_events[event_idx].start_ms <= w_start_ms:
            e = sorted_events[event_idx]
            tokens.append(f"[{e.type.upper()} ({e.duration_ms/1000:.1f}s)]")
            event_idx += 1
        w_text = w.get("word", "").strip()
        if w_text:
            tokens.append(w_text)
    # Any events that start after the last word (e.g. a trailing pause)
    while event_idx < len(sorted_events):
        e = sorted_events[event_idx]
        tokens.append(f"[{e.type.upper()} ({e.duration_ms/1000:.1f}s)]")
        event_idx += 1

    transcript_data["marked_text"] = " ".join(tokens).strip()
    logger.info(
        "Stitcher marked_text built: %d word-tokens + %d event markers = %d total tokens",
        sum(1 for w in valid_words if w.get("word", "").strip()), len(sorted_events), len(tokens),
    )

    # Log all events for visibility (so we can see long pauses too)
    logger.info("Stitcher final event list (%d events):", len(detected_events))
    for e in detected_events:
        text_str = f": '{e.spoken_text}'" if e.spoken_text else ""
        logger.info("  [%s] %.1fs - %.1fs%s", e.type, e.start_ms/1000, e.end_ms/1000, text_str)
            
    timeline = StitchedTimeline(
        duration_ms=duration_ms,
        transcript_timeline=timestamped_words,
        visual_events=[event for event in detected_events if event.type != "long pause"],
        acoustic_pauses=[event for event in detected_events if event.type == "long pause"],
        marked_text=transcript_data["marked_text"],
    )
    return transcript_data, detected_events, timeline
