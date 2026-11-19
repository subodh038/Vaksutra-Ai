import { fetchWithAuth } from "./auth";

/**
 * api.ts — typed client for the VakSutra AI Backend
 *
 * Mirrors the Pydantic response models in backend/models.py exactly.
 * All shapes must stay in sync with the backend/models/schemas.py.
 */

// ── Response shape mirrors (keep in sync with backend/models.py) ─────────────

export interface GazeBreakdown {
  center_pct: number;
  left_pct: number;
  right_pct: number;
  down_pct: number;
  away_pct: number;
}

export interface EmotionSummary {
  avg_brow_raise: number;
  avg_confusion: number;
  avg_stress: number;
  avg_frown: number;
  avg_squint: number;
  avg_smile: number;
  avg_blink_rate: number;
}

export interface HeadPoseSummary {
  avg_eye_contact: number;
  avg_head_pose: number;
  avg_head_pitch: number;
  avg_head_roll: number;
}

export interface AcousticStats {
  pitch_variation: number;
  avg_volume: number;
  pause_count: number;
  longest_pause_ms: number;
  total_pause_time_ms: number;
  avg_pause_ms: number;
  wpm: number;
  articulation_rate: number;
  filler_word_ratio: number;
}

export interface LinguisticStats {
  weak_words_count: number;
  weak_words_found: string[];
  run_on_sentences: number;
  top_repeated_words: string[];
  filler_words_found: string[];
  filler_word_ratio: number;
}

export interface DerivedInsights {
  pacing_status: string;
  vocal_variety: string;
  silence_ratio_pct: number;
  audience_connection_pct: number;
  warmth_index: string;
  fidget_index: string;
  filler_severity: string;
}

export interface BeforeAfterCorrection {
  category: string;
  before: string;
  after: string;
  why: string;
}

export interface MomentAnnotation {
  event_type: string;
  start_ms: number;
  end_ms: number;
  spoken_text?: string;
  impact: string;
}

export interface MainBottleneck {
  title: string;
  evidence: string;
  impact: string;
}

export interface ProgressMemory {
  improved_since_last: string;
  repeating_pattern: string;
}

export interface ProofMoment {
  timestamp_ms?: number;
  original_words: string;
  better_version: string;
  why_this_works: string;
}

export interface CoachingReport {
  analysis_scratchpad: string;
  executive_summary?: string;
  coach_review?: string;
  main_bottleneck?: MainBottleneck;
  progress_memory?: ProgressMemory;
  proof_moment?: ProofMoment;
  corrections: BeforeAfterCorrection[];
  framework_detected?: string | null;
  strengths: string[];
  gap_analysis: string[];
  improvement_plan: string[];
  moment_annotations: MomentAnnotation[];
}

export interface PipelineStatus {
  is_partial: boolean;
  warnings: string[];
}

export interface AnalysisResponse {
  audio_received_bytes: number;
  frame_count: number;
  face_detected_pct: number;
  gaze: GazeBreakdown;
  emotion: EmotionSummary;
  head_pose: HeadPoseSummary;
  acoustic_stats?: AcousticStats;
  linguistic_stats?: LinguisticStats;
  insights?: DerivedInsights;
  overall_score: number;
  feedback: string[];
  detected_events: DetectedEvent[];
  score_ranges: ScoreRanges;
  transcript: string;
  calibration_session_id?: string;
  coaching_report?: CoachingReport;
  pipeline_status?: PipelineStatus;
}

export interface DetectedEvent {
  type: string;          // e.g. "eye_contact_break", "gaze_away"
  start_ms: number;
  end_ms: number;
  duration_ms: number;
  peak_value: number | null;
  spoken_text?: string;
}

export interface ScoreRanges {
  eye_contact_min: number;
  eye_contact_max: number;
  eye_contact_avg: number;
  anxiety_min: number;
  anxiety_max: number;
  anxiety_avg: number;
  stress_min: number;
  stress_max: number;
  stress_avg: number;
  smile_min: number;
  smile_max: number;
  smile_avg: number;
}

// ── Config ────────────────────────────────────────────────────────────────────

const BACKEND_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

export const API_URL = BACKEND_URL;

// ── Request ───────────────────────────────────────────────────────────────────

export interface AnalyzePayload {
  audioBlob: Blob;
  frameData: {
    mediapipeReady: boolean;
    frameAnalysis: object[];
  };
  mode?: string;
  topic?: string;   // The speaking prompt the user was given
  video_url?: string;
}

/**
 * POST /analyze
 *
 * Sends the audio WebM blob (Module A) and the MediaPipe frame-analysis JSON
 * to the FastAPI backend and returns the structured coaching report.
 */
export async function postAnalyze(payload: AnalyzePayload): Promise<AnalysisResponse> {
  const form = new FormData();
  form.append("audio", payload.audioBlob, "recording.webm");
  form.append("frame_data", JSON.stringify(payload.frameData));
  if (payload.mode) {
    form.append("mode", payload.mode);
  }
  if (payload.topic) {
    form.append("topic", payload.topic);
  }
  if (payload.video_url) {
    form.append("video_url", payload.video_url);
  }

  const res = await fetchWithAuth(`${BACKEND_URL}/analyze`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Backend /analyze returned ${res.status}: ${text}`);
  }

  return res.json() as Promise<AnalysisResponse>;
}

/**
 * GET /analyze/coach/{session_id}
 *
 * Polls for asynchronous LLM coaching report.
 */
export async function fetchCoachingReport(sessionId: string): Promise<CoachingReport | null> {
  const res = await fetchWithAuth(`${BACKEND_URL}/analyze/coach/${sessionId}`);
  if (res.status === 202) {
    return null; // still processing
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Backend coach polling failed ${res.status}: ${text}`);
  }
  return res.json() as Promise<CoachingReport>;
}

/**
 * Uploads a session video directly to Supabase Storage without the bytes
 * ever passing through FastAPI:
 *   1. Ask the backend for a short-lived signed upload URL (tiny JSON call)
 *   2. PUT the raw video bytes straight to Supabase in the background
 *
 * Returns the canonical storage path (NOT a public URL) which should be
 * sent to /analyze as video_url, or null if any step failed.
 */
export async function uploadSessionVideo(videoBlob: Blob): Promise<string | null> {
  try {
    const slot = await requestVideoUploadSlot();
    const ok = await putVideoToStorage(slot.uploadUrl, videoBlob);
    if (!ok) return null;
    return slot.path;
  } catch (e) {
    console.error("Session video upload failed:", e);
    return null;
  }
}

export interface VideoUploadSlot {
  uploadUrl: string;
  path: string;
}

/** Step 1 — ask FastAPI for a signed Supabase upload target. */
export async function requestVideoUploadSlot(): Promise<VideoUploadSlot> {
  const res = await fetchWithAuth(`${BACKEND_URL}/uploads/video/upload-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content_type: "video/webm" }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Upload URL request failed ${res.status}: ${text}`);
  }
  const data = await res.json();
  return { uploadUrl: data.upload_url, path: data.path };
}

/** Step 2 — stream the bytes browser → Supabase. Returns true on success. */
export async function putVideoToStorage(uploadUrl: string, videoBlob: Blob): Promise<boolean> {
  try {
    const res = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": videoBlob.type || "video/webm" },
      body: videoBlob,
    });
    if (!res.ok) {
      console.error("Direct video upload failed:", res.status, await res.text().catch(() => ""));
      return false;
    }
    return true;
  } catch (e) {
    console.error("Exception during direct video upload:", e);
    return false;
  }
}

/**
 * Resolves whatever is stored in session.video_url into a playable URL.
 * Handles both new storage paths (private bucket → signed URL) and legacy
 * full public URLs (dead since the bucket went private; their filename is
 * extracted and re-signed so old sessions play again).
 */
export async function resolveSessionVideoUrl(raw?: string): Promise<string | null> {
  if (!raw) return null;

  let path = raw;
  if (raw.startsWith("http")) {
    // Legacy public-URL row — recover the bare filename.
    path = raw.split("/").pop() || "";
    if (!path) return null;
    // Already-signed URLs can be used as-is.
    if (raw.includes("token=")) return raw;
  }

  try {
    const res = await fetchWithAuth(
      `${BACKEND_URL}/uploads/video/view-url?path=${encodeURIComponent(path)}`
    );
    if (!res.ok) {
      console.warn(`Could not sign video path "${path}" (${res.status}).`);
      return null;
    }
    const data = await res.json();
    return data.url as string;
  } catch (e) {
    console.error("Failed to resolve session video URL:", e);
    return null;
  }
}

