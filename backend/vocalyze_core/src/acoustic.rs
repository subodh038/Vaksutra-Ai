/// acoustic.rs — Core acoustic analysis algorithms in pure Rust.
///
/// Implements:
///   yin_pitch()     — YIN F0 estimation (de Cheveigné & Kawahara, 2002)
///   rms_energy()    — Root Mean Square energy per frame
///   detect_pauses() — Silence gap detection via energy threshold
///
/// All functions accept raw f32 PCM samples and return plain Rust types
/// that PyO3 converts automatically to Python lists/tuples.

/// ── YIN pitch estimation ────────────────────────────────────────────────────
///
/// Steps (following the original YIN paper):
///   1. Difference function d(tau)
///   2. Cumulative Mean Normalized Difference Function (CMNDF)
///   3. Absolute threshold + parabolic interpolation
///   4. f0 = sr / tau_refined
pub fn yin_pitch(
    samples: &[f32],
    sr: u32,
    fmin: f32,
    fmax: f32,
    frame_length: usize,
    hop_length: usize,
    threshold: f32,
) -> (Vec<f32>, Vec<bool>) {
    if samples.is_empty() || frame_length == 0 {
        return (vec![], vec![]);
    }

    // tau range that covers fmin..fmax
    let tau_min = ((sr as f32 / fmax).ceil() as usize).max(1);
    let tau_max = ((sr as f32 / fmin).floor() as usize).min(frame_length / 2);

    if tau_min >= tau_max {
        return (vec![], vec![]);
    }

    let integration_window = frame_length / 2;
    let mut f0_out = Vec::new();
    let mut voiced_out = Vec::new();

    let mut frame_start = 0;
    while frame_start + frame_length <= samples.len() {
        let frame = &samples[frame_start..frame_start + frame_length];

        // ── Step 1: Difference function ──────────────────────────────────────
        // d(tau) = sum_{j=0}^{W-1} (x[j] - x[j+tau])^2
        let mut diff = vec![0.0f32; tau_max + 1];
        for tau in tau_min..=tau_max {
            let mut sum = 0.0f32;
            let limit = integration_window.min(frame.len().saturating_sub(tau));
            for j in 0..limit {
                let delta = frame[j] - frame[j + tau];
                sum += delta * delta;
            }
            diff[tau] = sum;
        }

        // ── Step 2: CMNDF ─────────────────────────────────────────────────────
        // d'(0) = 1, d'(tau) = d(tau) * tau / sum_{j=1}^{tau} d(j)
        let mut cmndf = vec![1.0f32; tau_max + 1];
        let mut running_sum = 0.0f32;
        for tau in 1..=tau_max {
            running_sum += diff[tau];
            if running_sum > 1e-10 {
                cmndf[tau] = diff[tau] * tau as f32 / running_sum;
            } else {
                cmndf[tau] = 1.0;
            }
        }

        // ── Step 3: Absolute threshold — first local minimum below threshold ──
        let mut best_tau: Option<usize> = None;

        // Find first tau where cmndf < threshold and is a local minimum
        for tau in (tau_min + 1)..tau_max {
            if cmndf[tau] < threshold
                && cmndf[tau] <= cmndf[tau - 1]
                && cmndf[tau] <= cmndf[tau + 1]
            {
                best_tau = Some(tau);
                break;
            }
        }

        // Fallback: global minimum in range (YIN paper §3 step 5)
        if best_tau.is_none() {
            let mut min_val = f32::MAX;
            let mut min_tau = tau_min;
            for tau in tau_min..=tau_max {
                if cmndf[tau] < min_val {
                    min_val = cmndf[tau];
                    min_tau = tau;
                }
            }
            if min_val < 0.5 {
                // Only accept fallback if somewhat confident
                best_tau = Some(min_tau);
            }
        }

        match best_tau {
            Some(tau) => {
                // ── Step 4: Parabolic interpolation ──────────────────────────
                let tau_refined = if tau > tau_min && tau < tau_max {
                    let alpha = cmndf[tau - 1];
                    let beta = cmndf[tau];
                    let gamma = cmndf[tau + 1];
                    let denom = alpha - 2.0 * beta + gamma;
                    if denom.abs() > 1e-6 {
                        tau as f32 - 0.5 * (gamma - alpha) / denom
                    } else {
                        tau as f32
                    }
                } else {
                    tau as f32
                };

                let f0 = (sr as f32 / tau_refined).clamp(fmin, fmax);
                f0_out.push(f0);
                voiced_out.push(true);
            }
            None => {
                // Unvoiced frame: push sentinel value (fmin) — matches librosa.yin behaviour
                f0_out.push(fmin);
                voiced_out.push(false);
            }
        }

        frame_start += hop_length;
    }

    (f0_out, voiced_out)
}


/// ── RMS energy per frame ────────────────────────────────────────────────────
///
/// Equivalent to librosa.feature.rms(y, frame_length, hop_length).
/// Returns one RMS value per frame. Trailing partial frames are included.
pub fn rms_energy(samples: &[f32], frame_length: usize, hop_length: usize) -> Vec<f32> {
    if samples.is_empty() || frame_length == 0 {
        return vec![];
    }

    let mut result = Vec::new();
    let mut start = 0;

    while start < samples.len() {
        let end = (start + frame_length).min(samples.len());
        let frame = &samples[start..end];
        let mean_sq = frame.iter().map(|&x| x * x).sum::<f32>() / frame.len() as f32;
        result.push(mean_sq.sqrt());
        start += hop_length;
    }

    result
}


/// ── Pause (silence gap) detection ──────────────────────────────────────────
///
/// Returns inter-speech pauses only (leading and trailing silence excluded).
/// Equivalent to the gap-finding logic in WaveformAnalyzer.detect_pauses().
///
/// Parameters
/// ----------
/// samples      : f32 PCM at any sample rate
/// sr           : sample rate in Hz
/// top_db       : silence threshold — audio > top_db below peak is silent (e.g. 30.0)
/// min_pause_ms : minimum gap duration to report (e.g. 300.0)
///
/// Returns list of (start_ms, end_ms, duration_ms) tuples.
pub fn detect_pauses(
    samples: &[f32],
    sr: u32,
    top_db: f32,
    min_pause_ms: f32,
) -> Vec<(f32, f32, f32)> {
    if samples.is_empty() || sr == 0 {
        return vec![];
    }

    // Compute per-frame RMS with small windows for fine-grained silence detection
    let frame_length = 512usize;
    let hop_length = 256usize;
    let rms = rms_energy(samples, frame_length, hop_length);

    if rms.is_empty() {
        return vec![];
    }

    // Peak RMS → linear silence threshold
    let max_rms = rms.iter().cloned().fold(0.0f32, f32::max);
    if max_rms < 1e-8 {
        return vec![]; // fully silent recording
    }
    let linear_threshold = max_rms * 10.0f32.powf(-top_db / 20.0);

    // Per-frame silence mask
    let is_silent: Vec<bool> = rms.iter().map(|&r| r <= linear_threshold).collect();

    let hop_ms = hop_length as f32 / sr as f32 * 1000.0;

    // Walk the mask — collect inter-speech gaps only
    let mut pauses = Vec::new();
    let mut in_speech = false;
    let mut in_silence = false;
    let mut silence_start_frame = 0usize;

    for (i, &silent) in is_silent.iter().enumerate() {
        if !silent {
            // Speech frame
            if in_silence && in_speech {
                // Close out the pause
                let start_ms = silence_start_frame as f32 * hop_ms;
                let end_ms = i as f32 * hop_ms;
                let duration_ms = end_ms - start_ms;
                if duration_ms >= min_pause_ms {
                    pauses.push((start_ms, end_ms, duration_ms));
                }
            }
            in_silence = false;
            in_speech = true;
        } else if in_speech && !in_silence {
            // First silent frame after speech — start a potential pause
            in_silence = true;
            silence_start_frame = i;
        }
        // Leading silence (in_speech=false): ignored entirely
        // Trailing silence: loop ends while in_silence=true → not pushed → intentional
    }

    pauses
}
