"""Unit tests for boundary-silence handling in acoustic preprocessing."""

import io

import librosa
import numpy as np
import pytest
import soundfile as sf

import core.acoustic.waveform_analyzer as wfa
from core.acoustic.waveform_analyzer import WaveformAnalyzer


@pytest.mark.skipif(
    wfa._RUST_AVAILABLE,
    reason="Rust detect_pauses bypasses the librosa monkeypatch; "
           "this test exercises the librosa fallback branch.",
)
def test_detect_pauses_ignores_recorder_startup_silence(monkeypatch):
    analyzer = WaveformAnalyzer(b"unused")
    analyzer.y = np.zeros(1_000)
    analyzer.sr = 1_000
    monkeypatch.setattr(
        librosa.effects,
        "split",
        lambda *_args, **_kwargs: np.array([[200, 400], [600, 900]]),
    )

    pauses = analyzer.detect_pauses(min_pause_ms=100)

    assert pauses == [{"start_ms": 400.0, "end_ms": 600.0, "duration_ms": 200.0}]


def test_trim_keeps_leading_silence_and_removes_only_trailing_silence(monkeypatch):
    analyzer = WaveformAnalyzer(b"unused")
    analyzer.y = np.zeros(1_000)
    analyzer.sr = 1_000
    monkeypatch.setattr(
        librosa.effects,
        "split",
        lambda *_args, **_kwargs: np.array([[200, 650]]),
    )

    trimmed = analyzer.get_trimmed_audio_bytes()
    samples, sample_rate = sf.read(io.BytesIO(trimmed))

    assert sample_rate == 1_000
    assert len(samples) == 650


def test_pause_detection_and_trimming_reuse_silence_boundaries(monkeypatch):
    analyzer = WaveformAnalyzer(b"unused")
    analyzer.y = np.zeros(1_000)
    analyzer.sr = 1_000
    calls = 0

    def split(*_args, **_kwargs):
        nonlocal calls
        calls += 1
        return np.array([[100, 650]])

    monkeypatch.setattr(librosa.effects, "split", split)

    analyzer.detect_pauses()
    analyzer.get_trimmed_audio_bytes()

    assert calls == 1
