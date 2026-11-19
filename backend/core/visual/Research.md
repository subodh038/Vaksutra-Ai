# Visual AI Event Selection & Calibration Report

This document records the exact reasoning behind why we track specific facial events, and how their thresholds were mathematically calibrated using our internal `yt_calibration.py` tool.

## The Problem With Raw MediaPipe
MediaPipe outputs 52 raw "blendshapes" (facial muscle probabilities) between `0.0` and `1.0`. Originally, thresholds were guessed (e.g., `smile > 0.45`). This caused severe frame-by-frame flickering ("jitter") and false positives because human faces are completely asymmetrical and move unpredictably during normal speech.

To solve this, we:
1. Implemented **Exponential Moving Average (EMA) Smoothing** (`alpha=0.7`) to kill frame-level jitter.
2. Ran 5 extreme test videos (Dr. Ekman FACS, Actor Expressions, Standard Interviews, HireVue Mistakes) through a calibration script to find the *true* boundaries of human expression.

## Event Selection & Calibrated Thresholds

### 1. Eye Contact Break (`eye_contact_break`) & Gaze Away (`gaze_away`)
- **Why we track it:** Maintaining eye contact is the strongest physical indicator of confidence, engagement, and honesty in an interview or presentation.
- **Old Threshold:** `eyeContactScore < 0.40`
- **New Threshold:** `eyeContactScore < 0.10`
- **The Empirical Data:** Our math calculates eye contact based on iris position relative to the socket. We found that even when looking perfectly at the camera, slight head movements or glasses cause the raw score to drop to `0.55 - 0.65`. A slight head turn drops it to `0.18`. Therefore, an `eye_contact_break` only genuinely occurs if the score dips below `0.10`.
- **Gaze Away:** We use a wider `gazeZone != center` constraint for a sustained `800ms` duration to catch blatant distraction (e.g., staring down at notes off-screen).

### 2. Frustration / Frown (`frown`)
- **Why we track it:** Frowning (FACS AU15 - Lip Corner Depressor) is a universal sign of frustration, confusion, or negative conflict.
- **Old Threshold:** `> 0.40`
- **New Threshold:** `> 0.20`
- **The Empirical Data:** In our test video, Dr. Ekman demonstrated the most extreme, caricature-like frown physically possible. MediaPipe scored that absolute maximum at `0.32`. Therefore, the old `0.40` threshold was mathematically impossible to hit. `0.20` perfectly captures standard, genuine expressions of frustration.

### 3. Warmth / Positivity (`smile`)
- **Why we track it:** A genuine smile (FACS AU12 - Lip Corner Puller) builds rapport, approachability, and sales effectiveness. 
- **Old Threshold:** `> 0.45`
- **New Threshold:** `> 0.60`
- **The Empirical Data:** Actors holding a polite, resting "pleasant" face idled around `0.25 - 0.45`. Raising the threshold to `0.60` ensures the AI only credits the user when they provide a genuine, wide (Duchenne) smile, stopping the system from falsely praising a normal resting face.

### 4. Anxiety / Brow Raise (`brow_raise`)
- **Why we track it:** The inner brow raise (FACS AU1) is a strong indicator of anxiety, disbelief, or seeking reassurance from an audience.
- **Old Threshold:** `> 0.60`
- **New Threshold:** `> 0.65`
- **The Empirical Data:** Bumping this slightly to `0.65` completely eliminated false positives caused by natural conversational emphasis (people naturally raise their brows slightly to highlight a word).

### 5. High Stress (`high_stress`)
- **Why we track it:** The "mouth press" (FACS AU20) is an involuntary micro-expression that humans make when experiencing high cognitive load or nervous tension. 
- **Old Threshold:** `> 0.45`
- **New Threshold:** `> 0.35`
- **The Empirical Data:** Normal, confident speech does not trigger the mouth press muscles. Lowering the threshold to `0.35` makes the AI slightly more sensitive to catching this tension *before* it spirals into full-blown panic.

### 6. Distraction Caveat (`eye_closure`)
- **Why we track it:** Rapid blinking indicates panic/lying; long closures indicate sleeping or severe disengagement.
- **The Caveat We Found:** In the HireVue test video, a candidate looked sharply down into his lap to check his phone. MediaPipe's mesh lost sight of his pupils and falsely triggered `eye_closure`.
- **The Fix:** We implemented a logical constraint: `f.gazeZone == "center"`. The system will now suppress `eye_closure` events if the user is looking away/down, correctly classifying it as distraction rather than sleeping.

---

## August 2026 — Signal Audit Addendum (frontend + backend alignment)

Full audit vs Google AI Edge docs, FACS/ARKit references, and comparable repos
(MindMirror, InterviewPilot, KwonGeneral). Changes landed this pass:

1. **Iris landmark groups corrected** on the frontend: iris-A = 468-472 ↔ eye
   corners 33/133; iris-B = 473-477 ↔ corners 263/362 (official mapping).
   Previously the split straddled both irises and never used landmark 477.
2. **`anxietyScore` renamed `browRaiseScore`** everywhere (schema, EMA keys,
   brow_raise predicate, score_ranges, emotion summary, scoring, memory rules).
   browInnerUp (AU1) fires on surprise/emphasis — it is an observation, not a
   diagnosis. Memory "visible" rule now uses max(brow raise, mouth press) > 0.5.
3. **Smile scale**: frontend now reports per-side average (was sum). The smile
   event gate moved from `>0.60` (sum) to `>0.30` (avg) — identical effective
   strictness.
4. **Duchenne guard extended**: `eyeSquint > 0.15 OR cheekSquint > 0.05`
   (cheekSquint = AU6, the canonical cheek-raiser; new frame field,
   EMA-smoothed alongside the others).
5. **Blendshape gaze prototype**: frames now carry `gazeXBs/gazeYBs` (-1..+1)
   derived from the eight `eyeLook*` coefficients, captured for offline A/B
   against the geometric iris method before any classification switch.

Unchanged after review (within source-supported ranges): gaze zone gates
±0.55 eye-widths with the 800ms sustain, headPose ÷0.12 proxy (~MindMirror's
12° yaw), blink >0.50 / 500ms / 2-sample gate, mouth-open 0.01 lip-gap flag.
Open validation item: the ×0.55 head-yaw compensation factor is novel to this
codebase — collect compensated-vs-raw telemetry during beta.
