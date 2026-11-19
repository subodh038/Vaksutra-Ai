"""
models/schemas.py — Pydantic I/O contracts for the Vocalyze AI Backend.

Input
-----
FrameAnalysisPayload  : mirrors the frontend's AnalyzeVideoResult type.
  └─ frameAnalysis: List[FrameAnalysisEntry]

Output
------
AnalysisResponse      : full coaching report returned by POST /analyze.
  ├─ GazeBreakdown
  ├─ EmotionSummary
  ├─ HeadPoseSummary
  ├─ AcousticStats
  ├─ LinguisticStats
  ├─ List[DetectedEvent]
  └─ ScoreRanges
"""

from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


# ── Input models ──────────────────────────────────────────────────────────────

class FrameAnalysisEntry(BaseModel):
    """
    One sample captured by the frontend MediaPipe pipeline.
    Timestamps are in milliseconds from the start of the recording,
    matching the audio blob's own timeline (both share the same t=0).
    """

    timestamp: float = Field(..., allow_inf_nan=False, description="ms from recording start")

    # ── Gaze & head pose ──
    eyeContactScore: float = Field(..., ge=0.0, le=1.0)
    headPoseScore:   float = Field(..., ge=0.0, le=1.0)
    faceDetected:    bool
    headPitch:       float = Field(..., allow_inf_nan=False, description="degrees, negative = head up")
    headRoll:        float = Field(..., allow_inf_nan=False, description="degrees")

    # ── Blendshape basics ──
    mouthOpenScore: float = Field(..., ge=0.0, le=1.0)
    smileScore:     float = Field(..., ge=0.0, le=1.0)
    blinkScore:     float = Field(..., ge=0.0, le=1.0)

    # ── Extended blendshape signals ──
    # browRaiseScore = browInnerUp (AU1): fires on surprise/emphasis/concern —
    # an OBSERVATION, not an anxiety diagnosis (honest naming).
    browRaiseScore:   float = Field(..., ge=0.0, le=1.0)
    cheekSquintScore: float = Field(default=0.0, ge=0.0, le=1.0)  # AU6 Duchenne marker
    confusionScore: float = Field(..., ge=0.0, le=1.0)
    stressScore:    float = Field(..., ge=0.0, le=1.0)
    frownScore:     float = Field(..., ge=0.0, le=1.0)
    squintScore:    float = Field(..., ge=0.0, le=1.0)
    mockingScore:   float = Field(..., ge=0.0, le=1.0)

    # ── Gaze zone ──
    gazeZone: Literal["center", "left", "right", "down", "up", "away"]

    # ── Blendshape gaze prototype (−1…+1) — captured for offline A/B vs the
    # geometric iris method; not yet used for classification.
    gazeXBs: float = Field(default=0.0, ge=-1.0, le=1.0)
    gazeYBs: float = Field(default=0.0, ge=-1.0, le=1.0)

    # ── Advanced metrics ──
    faceWidth: float = Field(..., ge=0.0, allow_inf_nan=False)

    # ── Body pose (always zeroed — PoseLandmarker dropped for CPU perf) ──
    poseDetected:      bool  = False
    postureScore:      float = Field(default=0.0, allow_inf_nan=False)
    shoulderLevelDiff: float = Field(default=0.0, allow_inf_nan=False)
    spineAngle:        float = Field(default=0.0, allow_inf_nan=False)
    armsCrossed:       bool  = False


class FrameAnalysisPayload(BaseModel):
    """
    The full payload sent from the frontend after MediaPipe analysis completes.
    Mirrors frontend's `AnalyzeVideoResult` type from src/lib/videoAnalysis.ts.
    """

    mediapipeReady: bool
    frameAnalysis:  List[FrameAnalysisEntry]


# ── Output sub-models ─────────────────────────────────────────────────────────

class DetectedEvent(BaseModel):
    """
    A notable moment extracted from the dense frame timeline.
    Produced by event_detection.detect_events().
    All timestamps are ms from recording start (same t=0 as the audio).
    """

    type:        str
    start_ms:    float
    end_ms:      float
    duration_ms: float
    peak_value:  Optional[float] = None   # highest/worst score during the event
    spoken_text: Optional[str] = None     # Words spoken while this event was happening


class ScoreRanges(BaseModel):
    """
    Raw min/max/avg per signal — surfaced in the response so thresholds in
    event_detection.py can be tuned against actual score distributions
    rather than guessed in the abstract.
    """

    eye_contact_min: float
    eye_contact_max: float
    eye_contact_avg: float
    anxiety_min:     float
    anxiety_max:     float
    anxiety_avg:     float
    stress_min:      float
    stress_max:      float
    stress_avg:      float
    smile_min:       float
    smile_max:       float
    smile_avg:       float


class GazeBreakdown(BaseModel):
    """Percentage of frames spent in each gaze zone (0–100)."""

    center_pct: float
    left_pct:   float
    right_pct:  float
    down_pct:   float
    away_pct:   float


class EmotionSummary(BaseModel):
    """Average blendshape scores across all face-detected frames."""

    avg_brow_raise: float
    avg_confusion:  float
    avg_stress:     float
    avg_frown:      float
    avg_squint:     float
    avg_smile:      float
    avg_blink_rate: float


class HeadPoseSummary(BaseModel):
    """Average head-pose and eye-contact scores across face-detected frames."""

    avg_eye_contact: float
    avg_head_pose:   float
    avg_head_pitch:  float
    avg_head_roll:   float


class AcousticStats(BaseModel):
    """Acoustic features extracted from the raw audio waveform."""

    pitch_variation:     float
    avg_volume:          float
    pause_count:         int
    longest_pause_ms:    float
    total_pause_time_ms: float
    avg_pause_ms:        float = 0.0
    wpm:                 float = 0.0
    articulation_rate:   float = 0.0
    filler_word_ratio:   float = 0.0


class LinguisticStats(BaseModel):
    """Linguistic quality metrics derived from the Whisper transcript."""

    weak_words_count:    int
    weak_words_found:    List[str]
    run_on_sentences:    int
    top_repeated_words:  List[str]
    filler_words_found:  List[str] = []
    filler_word_ratio:   float = 0.0  # filler count / total word count


class TimestampedWord(BaseModel):
    """One Whisper word on the shared recording timeline, in milliseconds."""

    word: str
    start_ms: float
    end_ms: float


class PipelineStatus(BaseModel):
    """Whether every optional analysis stage completed successfully."""

    is_partial: bool = False
    warnings: List[str] = Field(default_factory=list)


class StitchedTimeline(BaseModel):
    """Typed, timestamp-correlated data used by the coaching reasoning layer."""

    duration_ms: float = 0.0
    transcript_timeline: List[TimestampedWord] = Field(default_factory=list)
    visual_events: List[DetectedEvent] = Field(default_factory=list)
    acoustic_pauses: List[DetectedEvent] = Field(default_factory=list)
    marked_text: str = ""


class DerivedInsights(BaseModel):
    """Speaker-friendly qualitative metrics derived directly from deterministic raw signals."""
    
    pacing_status: str             # e.g., "Sluggish", "Conversational", "Rushed"
    pacing_wpm: float              # Exact words per minute
    vocal_variety: str             # e.g., "Monotone", "Dynamic", "Highly Expressive"
    vocal_pitch_var: float         # Exact pitch standard deviation
    silence_ratio_pct: float       # 0.0 to 100.0
    audience_connection_pct: float # 0.0 to 100.0
    warmth_index: str              # e.g., "Serious", "Approachable", "Radiant"
    warmth_smile_pct: float        # Exact average smile score (0.0 to 100.0)
    composure_index: str           # e.g., "Composed", "Tense"
    composure_anxiety_stress_pct: float # Combined anxiety/stress score (0.0 to 100.0)
    fidget_index: str              # e.g., "Calm", "Restless"
    fidget_count: int              # Exact number of times the user looked away
    filler_severity: str           # e.g., "Clean", "Noticeable", "Distracting"
    filler_pct: float              # Exact percentage of filler words


# ── LLM Coaching Report models ──────────────────────────────────────────────────────────────────────

class BeforeAfterCorrection(BaseModel):
    """
    A single Before/After/Why coaching correction.
    `before` must be an exact quote from the transcript — never invented.
    """
    category: str    # matches a correction_category from the mode rubric
    before:   str    # exact quote from transcript
    after:    str    # corrected/improved version
    why:      str    # clear, friendly coaching explanation


class MomentAnnotation(BaseModel):
    """
    A timestamped coaching annotation tied to a real detected_event.
    `impact` must describe communication impact only — no mental-state diagnosis.
    """
    event_type:  str
    start_ms:    float
    end_ms:      float
    spoken_text: Optional[str] = None   # words spoken during the event
    impact:      str                    # plain-language communication impact


class MainBottleneck(BaseModel):
    """The single highest-leverage diagnosis for this session."""

    title:   str = ""
    evidence: str = ""  # exact metric, quote, timestamp, or observed event
    impact:  str = ""


class ProgressMemory(BaseModel):
    """How this session connects to the speaker's history."""

    improved_since_last: str = ""
    repeating_pattern:   str = ""


class ProofMoment(BaseModel):
    """One concrete moment that proves the diagnosis and shows a rewrite."""

    timestamp_ms:      Optional[float] = None
    original_words:    str = ""  # exact quote from transcript when present
    better_version:    str = ""
    why_this_works:    str = ""


class ExtraCoachingDetails(BaseModel):
    """Secondary details shown behind deeper UI, not as the main report."""

    strengths:          List[str] = Field(default_factory=list)
    corrections:        List[BeforeAfterCorrection] = Field(default_factory=list)
    moment_annotations: List[MomentAnnotation] = Field(default_factory=list)


class CoachingReport(BaseModel):
    """
    Full LLM-generated coaching report.
    Produced by services/llm_coach.py from a single Mistral (or Groq fallback) call.
    The LLM must not invent transcript text, events, or numeric scores.
    """

    analysis_scratchpad: str = ""  # internal reasoning summary; not primary UI
    executive_summary:   str = ""  # legacy alias for coach_review
    coach_review:        str = ""
    main_bottleneck:     Optional[MainBottleneck] = None
    progress_memory:     Optional[ProgressMemory] = None
    proof_moment:        Optional[ProofMoment] = None
    extra_details:       ExtraCoachingDetails = Field(default_factory=ExtraCoachingDetails)
    corrections:         List[BeforeAfterCorrection] = Field(default_factory=list)  # legacy/detail
    framework_detected:  Optional[str] = None          # e.g. "STAR", "intro-body-conclusion"
    strengths:           List[str] = Field(default_factory=list)  # legacy/detail
    gap_analysis:        List[str] = Field(default_factory=list)  # legacy/detail
    improvement_plan:    List[str] = Field(default_factory=list)  # legacy/detail
    moment_annotations:  List[MomentAnnotation] = Field(default_factory=list)



# ── Pipeline → Mode data contract ──────────────────────────────────────────────────────────────

class RawSignals(BaseModel):
    """
    Intermediate data object produced by core/pipeline.py.
    Passed to the active BaseMode to compute score + feedback.
    All raw signal data is here; the mode decides what to weight.
    """

    frames:               List[FrameAnalysisEntry]
    face_frames:          List[FrameAnalysisEntry]
    face_detected_pct:    float

    gaze:      GazeBreakdown
    emotion:   EmotionSummary
    head_pose: HeadPoseSummary

    acoustic_stats:   Optional[AcousticStats]   = None
    linguistic_stats: Optional[LinguisticStats] = None

    detected_events: List[DetectedEvent]
    score_ranges:    ScoreRanges
    transcript:      str
    audio_received_bytes: int
    # Session duration in ms — last frame timestamp when frames exist,
    # otherwise the decoded audio duration (audio-only fallback sessions).
    # All scoring/insight math must use this instead of re-deriving from frames.
    duration_ms:     float = 0.0
    stitched_timeline: Optional[StitchedTimeline] = None
    pipeline_status: PipelineStatus = Field(default_factory=PipelineStatus)
    insights: Optional[DerivedInsights] = None  # attached post-hoc in pipeline.run_analysis()


# ── Top-level response model ──────────────────────────────────────────────────────────────

class AnalysisResponse(BaseModel):
    """
    Structured coaching report returned by POST /analyze.

    audio_received_bytes : size of the audio blob received (sanity check).
    frame_count          : total MediaPipe samples in the payload.
    face_detected_pct    : % of frames where a face was visible (0–100).
    gaze                 : distribution across gaze zones.
    emotion              : averaged emotion blendshape scores.
    head_pose            : averaged head-pose / eye-contact scores.
    acoustic_stats       : pitch, volume, pause, and speech-rate metrics.
    linguistic_stats     : weak words, fillers, run-ons, repetition.
    overall_score        : 0–100 composite presentation score.
    feedback             : human-readable coaching tips.
    detected_events      : sparse list of notable timestamped moments.
    score_ranges         : raw min/max/avg per signal (threshold tuning aid).
    transcript           : raw Whisper transcript text.
    stitched_timeline    : timestamp-correlated words and events for coaching.
    pipeline_status      : warnings when a non-fatal pipeline stage failed.
    insights             : derived speaker-friendly qualitative metrics.
    """

    audio_received_bytes: int
    frame_count:          int
    face_detected_pct:    float

    gaze:      GazeBreakdown
    emotion:   EmotionSummary
    head_pose: HeadPoseSummary

    acoustic_stats:   Optional[AcousticStats]   = None
    linguistic_stats: Optional[LinguisticStats] = None

    overall_score:   float       = Field(..., ge=0.0, le=100.0)
    feedback:        List[str]
    detected_events: List[DetectedEvent]
    score_ranges:    ScoreRanges
    transcript:      str         = ""
    stitched_timeline: Optional[StitchedTimeline] = None
    pipeline_status: PipelineStatus = Field(default_factory=PipelineStatus)
    calibration_session_id: Optional[str] = None
    insights: Optional[DerivedInsights] = None
    coaching_report: Optional[CoachingReport] = None

