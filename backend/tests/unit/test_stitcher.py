"""Unit tests for timestamp-safe transcript/event stitching."""

from core.stitching.stitcher import stitch_pipeline_data
from models.schemas import DetectedEvent


def _event(event_type: str, start_ms: float, end_ms: float) -> DetectedEvent:
    return DetectedEvent(
        type=event_type,
        start_ms=start_ms,
        end_ms=end_ms,
        duration_ms=end_ms - start_ms,
    )


def test_words_before_first_real_pause_are_not_removed():
    """Leading spoken words must survive now that audio keeps the original t=0."""
    transcript, events, timeline = stitch_pipeline_data(
        {
            "text": "Hello everyone",
            "words": [
                {"word": "Hello ", "start": 0.2, "end": 0.6},
                {"word": "everyone", "start": 0.7, "end": 1.1},
            ],
        },
        [_event("long pause", 1_500, 2_700)],
        duration_ms=3_000,
    )

    assert transcript["text"] == "Hello everyone"
    assert [word.word for word in timeline.transcript_timeline] == ["Hello", "everyone"]
    assert len(events) == 1


def test_word_inside_inter_speech_pause_is_removed_as_hallucination():
    transcript, _, timeline = stitch_pipeline_data(
        {
            "text": "Hello uh world",
            "words": [
                {"word": "Hello ", "start": 0.1, "end": 0.4},
                {"word": " uh ", "start": 1.2, "end": 1.4},
                {"word": "world", "start": 2.2, "end": 2.6},
            ],
        },
        [_event("long pause", 1_000, 2_000)],
        duration_ms=3_000,
    )

    assert "uh" not in transcript["text"]
    assert [word.word for word in timeline.transcript_timeline] == ["Hello", "world"]


def test_event_gets_overlapping_spoken_text_and_typed_timeline():
    transcript, events, timeline = stitch_pipeline_data(
        {
            "text": "I am working",
            "words": [
                {"word": "I ", "start": 0.0, "end": 0.2},
                {"word": "am ", "start": 0.2, "end": 0.4},
                {"word": "working", "start": 0.4, "end": 0.9},
            ],
        },
        [_event("gaze_away", 150, 700), _event("long pause", 1_000, 1_400)],
        duration_ms=1_500,
    )

    assert events[0].spoken_text == "I am working"
    assert timeline.duration_ms == 1_500
    assert [event.type for event in timeline.visual_events] == ["gaze_away"]
    assert [event.type for event in timeline.acoustic_pauses] == ["long pause"]
    assert "[GAZE_AWAY" in timeline.marked_text


def test_empty_transcript_still_returns_a_typed_timeline():
    _, _, timeline = stitch_pipeline_data(
        {"text": "", "words": []},
        [_event("gaze_away", 100, 700)],
        duration_ms=1_000,
    )

    assert timeline.duration_ms == 1_000
    assert timeline.transcript_timeline == []
    assert len(timeline.visual_events) == 1
