"""
core/acoustic/waveform_analyzer.py — Acoustic feature extraction for the Vocalyze AI Backend.

Two-step pipeline:
  1. Decode  : WebM → WAV via an ffmpeg subprocess.
  2. Analyse : Load the generated WAV with soundfile and extract:
       extract_pitch_contour()   — F0 via pyin (50–500 Hz)
       extract_energy_contour()  — RMS energy
       detect_pauses()           — silence gaps ≥ 300 ms / −18 dB
       summarize()               — returns a plain dict ready for AcousticStats

-18 dB default is intentionally loose (not -25/-40 as in earlier revisions) to
still catch pauses on noisy laptop/phone mic recordings, where the room noise
floor sits closer to peak volume than in a clean studio recording. Lower this
number (more negative) to be MORE permissive about what counts as silence;
raise it to require quieter pauses. Tune against real recordings and record
the chosen value + evidence in Research.md.
"""

# ── stdlib ──────────────────────────────────────────────────

import io
import logging
import os
import subprocess
import tempfile
import time
import soundfile as sf

# ── third-party ───────────────────────────────────────────────
import librosa
import numpy as np

logger = logging.getLogger(__name__)

# ── Rust extension (optional fast path) ───────────────────────────────────────
# Built with: cd vocalyze_core && maturin develop --release
# Falls back to librosa silently if not built.
try:
    import vocalyze_core as _vc
    _RUST_AVAILABLE = True
    logger.info("vocalyze_core Rust extension loaded — fast acoustic path active")
except ImportError:
    _vc = None
    _RUST_AVAILABLE = False
    logger.warning("vocalyze_core not built — using librosa fallback (run: cd vocalyze_core && maturin develop --release)")



MIN_PYIN_DURATION_S = 0.35

ANALYSIS_SAMPLE_RATE = 16_000

PITCH_ANALYSIS_SAMPLE_RATE = 8_000


class WaveformAnalyzer:
    """
    Extracts acoustic features (pitch, volume, pauses) from raw audio bytes.
    Uses ffmpeg to decode WebM and librosa for feature extraction.
    """

    def __init__(self, audio_bytes: bytes) -> None:
        self.audio_bytes = audio_bytes
        self.y: object   = None
        self.sr: object  = None
        self._non_silent_by_top_db: dict[int, np.ndarray] = {}

    # ── Loading ───────────────────────────────────────────────────────────────

    def load(self) -> None:
        """Decode WebM → WAV via ffmpeg, then read the PCM samples directly."""
        with tempfile.TemporaryDirectory() as tmpdir:
            webm_path = os.path.join(tmpdir, "audio.webm")
            wav_path  = os.path.join(tmpdir, "audio.wav")

            with open(webm_path, "wb") as fh:
                fh.write(self.audio_bytes)

            try:
                decode_started = time.perf_counter()
                subprocess.run(
                    [
                        "ffmpeg", "-i", webm_path,
                        "-vn", "-acodec", "pcm_s16le",
                        "-ar", str(ANALYSIS_SAMPLE_RATE), "-ac", "1",
                        wav_path,
                    ],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    check=True,
                )
            except subprocess.CalledProcessError as exc:
                raise RuntimeError("Failed to decode audio with ffmpeg.") from exc

            decode_seconds = time.perf_counter() - decode_started
            load_started = time.perf_counter()
            # ffmpeg has already produced exactly the analysis format we need:
            # 16 kHz, mono, PCM WAV. Reading it with soundfile avoids librosa's
            # general-purpose loading/resampling path.
            self.y, self.sr = sf.read(
                wav_path,
                dtype="float32",
                always_2d=False,
            )
            logger.info(
                "Acoustic timing  ffmpeg_decode=%.3fs  waveform_load=%.3fs  sr=%dHz",
                decode_seconds,
                time.perf_counter() - load_started,
                self.sr,
            )

    # ── Feature extraction ────────────────────────────────────────────────────

    def extract_pitch_contour(self) -> tuple:
        """
        Extract F0 (fundamental frequency) contour using librosa.yin.
        fmin=50 Hz, fmax=500 Hz covers the full human voice range.
        Runs on an 8 kHz downsampled copy of the audio (see
        PITCH_ANALYSIS_SAMPLE_RATE) purely for speed — pitch_variation only
        needs std(F0), not a frame-accurate contour.
        Voiced frames are identified by excluding boundary values (>55 Hz, <490 Hz)
        rather than pyin's probabilistic output — sufficient for computing std(F0).

        NOTE: Using yin (deterministic) instead of pyin (probabilistic). pyin's HMM
        causes a version-specific internal size error with our librosa build.

        Returns (None, None) instead of raising if the clip is too short for
        yin's window (< MIN_PYIN_DURATION_S) or if yin fails for any other
        reason (e.g. silent/corrupt audio) — callers must handle that case.
        """
        if self.y is None:
            self.load()

        duration_s = (len(self.y) / self.sr) if self.sr else 0.0
        if duration_s < MIN_PYIN_DURATION_S:
            logger.warning(
                "Clip too short for pitch extraction (%.3fs < %.2fs) — skipping pyin.",
                duration_s, MIN_PYIN_DURATION_S,
            )
            return None, None

        try:
            # Downsample specifically for pitch — see PITCH_ANALYSIS_SAMPLE_RATE
            if self.sr != PITCH_ANALYSIS_SAMPLE_RATE:
                y_pitch = librosa.resample(
                    self.y, orig_sr=self.sr, target_sr=PITCH_ANALYSIS_SAMPLE_RATE
                )
            else:
                y_pitch = self.y

            if _RUST_AVAILABLE:
                # Rust YIN: 186x faster than librosa on the same hardware
                # (43ms vs 12,545ms for 51s audio at 8 kHz).
                # Benchmark confirmed by test_pitch_bottleneck.py — 2026-09-03.
                f0_list, voiced_list = _vc.yin_pitch(
                    y_pitch.tolist(), PITCH_ANALYSIS_SAMPLE_RATE,
                    fmin=50.0, fmax=500.0,
                    frame_length=2048, hop_length=2048,
                    threshold=0.1,
                )
                f0 = np.array(f0_list, dtype=np.float32)
                voiced_flag = np.array(voiced_list)
            else:
                # librosa fallback — only used when Rust extension is not built
                f0 = librosa.yin(
                    y_pitch, fmin=50, fmax=500, sr=PITCH_ANALYSIS_SAMPLE_RATE,
                    frame_length=2048, hop_length=2048,
                )
                # yin clips unvoiced frames to fmin/fmax — exclude boundary values
                voiced_flag = (f0 > 55) & (f0 < 490)
            return f0, voiced_flag


        except Exception as exc:
            logger.warning("librosa.yin failed, returning empty pitch contour: %s", exc)
            return None, None

    def extract_energy_contour(self):
        """Extract RMS energy contour."""
        if self.y is None:
            self.load()
        if _RUST_AVAILABLE:
            return np.array(_vc.rms_energy(self.y.tolist(), 512, 256), dtype=np.float32)
        return librosa.feature.rms(y=self.y)[0]

    def _get_non_silent_intervals(self, top_db: int) -> np.ndarray:
        """Return cached silence boundaries for a given threshold."""
        if self.y is None:
            self.load()

        if top_db not in self._non_silent_by_top_db:
            self._non_silent_by_top_db[top_db] = librosa.effects.split(
                self.y,
                top_db=top_db,
            )
        return self._non_silent_by_top_db[top_db]

    def detect_pauses(
        self,
        silence_threshold_db: int = -30,
        min_pause_ms: int = 300,
    ) -> list[dict]:
        """
        Detect pauses in the audio.

        Parameters
        ----------
        silence_threshold_db : Silence threshold in dB (default −18 dB). Loose
                                on purpose — catches pauses under laptop/phone
                                mic background noise. More negative = more
                                permissive (more audio counts as silence).
        min_pause_ms         : Minimum pause duration to report (default 300 ms).

        Returns
        -------
        List of dicts: {'start_ms': float, 'end_ms': float, 'duration_ms': float}
        """
        if self.y is None:
            self.load()

        # ── Rust fast path ────────────────────────────────────────────────────
        if _RUST_AVAILABLE:
            raw = _vc.detect_pauses(
                self.y.tolist(), self.sr,
                top_db=float(abs(silence_threshold_db)),
                min_pause_ms=float(min_pause_ms),
            )
            return [
                {"start_ms": s, "end_ms": e, "duration_ms": d}
                for s, e, d in raw
            ]

        # ── librosa fallback ──────────────────────────────────────────────────
        non_silent = self._get_non_silent_intervals(abs(silence_threshold_db))
        pauses: list[dict] = []
        last_end_sample = 0

        for index, interval in enumerate(non_silent):
            start_sample = interval[0]
            # Startup silence is a recorder artefact, not a pause in speech.
            if index > 0 and start_sample > last_end_sample:
                pause_ms = (start_sample - last_end_sample) / self.sr * 1000
                if pause_ms >= min_pause_ms:
                    pauses.append({
                        "start_ms":    (last_end_sample / self.sr) * 1000,
                        "end_ms":      (start_sample    / self.sr) * 1000,
                        "duration_ms": pause_ms,
                    })
            last_end_sample = interval[1]
        # NOTE: trailing silence excluded intentionally (see docstring).

        return pauses

    # ── Summary ───────────────────────────────────────────────────────────────

    def summarize(self) -> tuple[dict, list[dict]]:
        """
        Return a statistical summary dict ready to be unpacked into AcousticStats,
        along with the raw pauses list to be surfaced as timeline events.
        Keys: pitch_variation, avg_volume, pause_count, longest_pause_ms, total_pause_time_ms.
        (wpm, articulation_rate, filler_word_ratio are added by core/pipeline.py
        after transcript and linguistic analysis complete.)
        """
        if self.y is None:
            self.load()

        pitch_started = time.perf_counter()
        f0, voiced_flag = self.extract_pitch_contour()
        pitch_ms = (time.perf_counter() - pitch_started) * 1000

        energy_started = time.perf_counter()
        rms = self.extract_energy_contour()
        energy_ms = (time.perf_counter() - energy_started) * 1000

        pauses_started = time.perf_counter()
        pauses = self.detect_pauses()
        pauses_ms = (time.perf_counter() - pauses_started) * 1000

        backend = "Rust ⚡" if _RUST_AVAILABLE else "librosa"
        total_ms = pitch_ms + energy_ms + pauses_ms
        logger.info(
            "Acoustic [%s]  pitch=%.1fms  rms=%.1fms  pauses=%.1fms  total=%.1fms",
            backend, pitch_ms, energy_ms, pauses_ms, total_ms,
        )

        valid_f0 = f0[voiced_flag] if f0 is not None else []

        return {
            # Real decoded-audio duration (ms). Used for WPM / silence-ratio
            # math when the frontend sent no MediaPipe frames (audio-only
            # fallback) — frames[-1].timestamp would be 0 there.
            "duration_ms":         float(len(self.y) / self.sr * 1000.0),
            "pitch_variation":     float(np.std(valid_f0))  if len(valid_f0) > 0 else 0.0,
            "avg_volume":          float(np.mean(rms))       if rms is not None and len(rms) > 0 else 0.0,
            "pause_count":         len(pauses),
            "longest_pause_ms":    max(p["duration_ms"] for p in pauses) if pauses else 0.0,
            "total_pause_time_ms": sum(p["duration_ms"] for p in pauses),
            "avg_pause_ms":        (
                sum(p["duration_ms"] for p in pauses) / len(pauses)
                if pauses else 0.0
            ),
        }, pauses

    def get_trimmed_audio_bytes(self) -> bytes:
        """
        Trim trailing silence only, preserving the original recording t=0.

        Whisper word timestamps must remain aligned with MediaPipe frames and
        acoustic events. Removing leading silence would shift every word back
        in time and corrupt the stitching layer.
        """
        if self.y is None:
            self.load()
            
        if self.y is None or len(self.y) == 0:
            return self.audio_bytes
            
        trim_started = time.perf_counter()
        non_silent = self._get_non_silent_intervals(top_db=30)
        if len(non_silent) == 0:
            return self.audio_bytes

        # Keep all audio through the final speech interval. This removes browser
        # recorder dead air at the end while retaining the shared t=0 origin.
        final_speech_end = int(non_silent[-1][1])
        y_trimmed = self.y[:final_speech_end]
        
        # Write back to bytes buffer in WAV format
        buffer = io.BytesIO()
        sf.write(buffer, y_trimmed, self.sr, format='WAV')
        logger.info(
            "Acoustic timing  trailing_trim_and_wav_encode=%.3fs",
            time.perf_counter() - trim_started,
        )
        return buffer.getvalue()
