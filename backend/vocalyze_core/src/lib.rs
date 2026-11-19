/// lib.rs — PyO3 bindings for the vocalyze_core Rust extension.
///
/// Exposes 3 Python-callable functions:
///   yin_pitch(samples, sr, fmin, fmax, frame_length, hop_length, threshold)
///   rms_energy(samples, frame_length, hop_length)
///   detect_pauses(samples, sr, top_db, min_pause_ms)
///
/// All inputs/outputs use plain Python lists — no numpy dependency in the
/// Rust layer. Python converts numpy arrays with .tolist() before calling.

use pyo3::prelude::*;

mod acoustic;

/// Estimate fundamental frequency (F0) using the YIN algorithm.
///
/// Parameters (Python)
/// -------------------
/// samples      : list[float]  — f32 PCM samples at `sr` Hz
/// sr           : int          — sample rate (e.g. 8000)
/// fmin         : float        — minimum F0 to detect in Hz (default 50.0)
/// fmax         : float        — maximum F0 to detect in Hz (default 500.0)
/// frame_length : int          — YIN window size in samples (default 2048)
/// hop_length   : int          — hop between frames in samples (default 2048)
/// threshold    : float        — CMNDF threshold, lower = stricter (default 0.1)
///
/// Returns
/// -------
/// (f0_list: list[float], voiced_list: list[bool])
/// f0_list[i] is fmin for unvoiced frames — filter with voiced_list[i] == True.
#[pyfunction]
#[pyo3(signature = (samples, sr, fmin=50.0, fmax=500.0, frame_length=2048, hop_length=2048, threshold=0.1))]
fn yin_pitch(
    samples: Vec<f32>,
    sr: u32,
    fmin: f32,
    fmax: f32,
    frame_length: usize,
    hop_length: usize,
    threshold: f32,
) -> (Vec<f32>, Vec<bool>) {
    acoustic::yin_pitch(&samples, sr, fmin, fmax, frame_length, hop_length, threshold)
}

/// Compute RMS energy per frame.
///
/// Parameters (Python)
/// -------------------
/// samples      : list[float]  — f32 PCM samples
/// frame_length : int          — window size in samples (default 512)
/// hop_length   : int          — hop between frames in samples (default 256)
///
/// Returns
/// -------
/// list[float] — one RMS value per frame
#[pyfunction]
#[pyo3(signature = (samples, frame_length=512, hop_length=256))]
fn rms_energy(samples: Vec<f32>, frame_length: usize, hop_length: usize) -> Vec<f32> {
    acoustic::rms_energy(&samples, frame_length, hop_length)
}

/// Detect inter-speech pauses (silence gaps) in PCM audio.
///
/// Parameters (Python)
/// -------------------
/// samples      : list[float]  — f32 PCM samples at `sr` Hz
/// sr           : int          — sample rate in Hz
/// top_db       : float        — silence = anything > top_db below peak RMS (default 30.0)
/// min_pause_ms : float        — minimum gap duration to report in ms (default 300.0)
///
/// Returns
/// -------
/// list[tuple[float, float, float]]
///   Each tuple is (start_ms, end_ms, duration_ms).
///   Leading and trailing silence are excluded — only inter-speech gaps returned.
#[pyfunction]
#[pyo3(signature = (samples, sr, top_db=30.0, min_pause_ms=300.0))]
fn detect_pauses(
    samples: Vec<f32>,
    sr: u32,
    top_db: f32,
    min_pause_ms: f32,
) -> Vec<(f32, f32, f32)> {
    acoustic::detect_pauses(&samples, sr, top_db, min_pause_ms)
}

/// Register the Python module.
#[pymodule]
fn vocalyze_core(m: &Bound<'_, PyModule>) -> PyResult<()> {
    m.add_function(wrap_pyfunction!(yin_pitch, m)?)?;
    m.add_function(wrap_pyfunction!(rms_energy, m)?)?;
    m.add_function(wrap_pyfunction!(detect_pauses, m)?)?;
    Ok(())
}
