"use client";

import { useEffect, useRef, useState } from "react";
import type { RecordingResult } from "@/app/page";
import { analyzeVideo, type FrameAnalysisEntry } from "@/lib/videoAnalysis";
import { postAnalyze, type AnalysisResponse } from "@/lib/api";
import BetaFeedbackModal from "@/components/BetaFeedbackModal";
import { 
  InfoTile, 
  ScoreCircle, 
  MetricCard, 
  BackendReport,
  ScoredTelemetryPanel,
  HighlightedTranscript,
  type BackendStatus,
} from "./DiagnosticComponents";

interface ReviewScreenProps {
  result?: RecordingResult; // Optional for history mode
  initialReport?: AnalysisResponse;
  initialVideoUrl?: string;
  onRetry?: () => void;
  onBack: () => void;
}

type AnalysisStatus = "idle" | "running" | "done" | "error";

function formatDuration(ms: number): string {
  if (!isFinite(ms) || isNaN(ms) || ms < 0) return "--:--";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

function formatDurationSec(sec: number): string {
  if (!isFinite(sec) || isNaN(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ReviewScreen({
  result,
  initialReport,
  initialVideoUrl,
  onRetry,
  onBack,
}: ReviewScreenProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(initialVideoUrl || null);

  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus>(
    initialReport ? "done" : "idle"
  );
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisError, setAnalysisError] = useState("");
  const [frameAnalysis, setFrameAnalysis] = useState<FrameAnalysisEntry[]>([]);
  const [mediapipeReady, setMediapipeReady] = useState(false);
  const [visualWarning, setVisualWarning] = useState("");

  const [backendStatus, setBackendStatus] = useState<BackendStatus>(
    initialReport ? "done" : "idle"
  );
  const [backendReport, setBackendReport] = useState<AnalysisResponse | null>(
    initialReport || null
  );
  const [backendError, setBackendError] = useState("");
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    if (initialVideoUrl) return; // History mode uses remote URL
    if (result && !videoUrl) {
      const url = URL.createObjectURL(result.videoBlob);
      setVideoUrl(url);
    }
    return () => {
      if (videoUrl && !initialVideoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [result, videoUrl, initialVideoUrl]);

  // Cancel any in-flight visual analysis when the screen unmounts so MediaPipe
  // stops burning CPU and pending state updates are abandoned.
  const analysisCancelledRef = useRef(false);
  useEffect(() => {
    return () => {
      analysisCancelledRef.current = true;
    };
  }, []);

  const effectiveDuration = (result?.durationMs ?? 0) > 0 ? (result!.durationMs / 1000) : duration || 1;

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.ended || videoRef.current.currentTime >= effectiveDuration - 0.1) {
      videoRef.current.currentTime = 0;
      setCurrentTime(0);
    }
    if (videoRef.current.paused) {
      videoRef.current.play().then(() => setIsPlaying(true)).catch((e) => console.error("Play error:", e));
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const vidDur = videoRef.current.duration;
      if (isFinite(vidDur) && !isNaN(vidDur) && vidDur > 0) {
        setDuration(vidDur);
      } else if ((result?.durationMs ?? 0) > 0) {
        setDuration(result!.durationMs / 1000);
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
    }
  };

  const toggleFullScreen = () => {
    if (videoRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        videoRef.current.requestFullscreen();
      }
    }
  };

  const handleAnalyze = async () => {
    if (!result) return;
    console.log("[ReviewScreen] ▶ Step 1: handleAnalyze started. Audio size:", result.audioBlob.size, "Video size:", result.videoBlob.size);
    setAnalysisStatus("running");
    setAnalysisProgress(0);
    setAnalysisError("");
    setBackendStatus("idle");
    setBackendReport(null);
    setBackendError("");
    setFrameAnalysis([]); // Clear old telemetry data

    let fa: FrameAnalysisEntry[] = [];
    let ready = false;

    // Visual analysis is best-effort: if MediaPipe fails to initialize or
    // throws, degrade gracefully and continue with audio-only scoring.
    setVisualWarning("");
    try {
      console.log("[ReviewScreen] ▶ Step 2: Triggering analyzeVideo...");
      if (analysisCancelledRef.current) return;
      const result_ = await analyzeVideo(result.videoBlob, (pct) => {
        if (!analysisCancelledRef.current) setAnalysisProgress(pct);
      }, {
        durationMs: result.durationMs,
        shouldCancel: () => analysisCancelledRef.current,
      });
      fa = result_.frameAnalysis;
      ready = result_.mediapipeReady;
      if (!analysisCancelledRef.current) {
        setFrameAnalysis(fa);
        console.log(`[ReviewScreen] ✔ Step 2: Visual analysis finished — ${fa.length} frames, mediapipeReady=${ready}`);
      }
    } catch (err) {
      console.error("[ReviewScreen] ✖ Step 2 failed: MediaPipe analysis threw:", err);
    }
    if (analysisCancelledRef.current) return;

    setMediapipeReady(ready);
    setAnalysisStatus("done");

    if (!ready) {
      setVisualWarning(
        "Camera/visual analysis unavailable — this session is scored on audio only."
      );
    }

    setBackendStatus("sending");
    try {
      // 1. Reserve a signed upload slot (fast JSON call — no video bytes).
      //    The bytes themselves go browser → Supabase in the background,
      //    so FastAPI never receives the heavy payload.
      let videoPath: string | undefined;
      try {
        console.log("[ReviewScreen] ▶ Step 3: Requesting signed video upload slot...");
        const { requestVideoUploadSlot, putVideoToStorage } = await import("@/lib/api");
        const slot = await requestVideoUploadSlot();
        videoPath = slot.path;
        // Await the PUT so /analyze never receives a video_url whose bytes
        // don't exist yet (slow uplinks previously lost this race).
        await putVideoToStorage(slot.uploadUrl, result.videoBlob);
        console.log("[ReviewScreen] ✔ Step 3: Video uploaded to storage:", videoPath);
      } catch (uploadErr) {
        console.warn("[ReviewScreen] ⚠ Step 3: Video upload failed — continuing without video:", uploadErr);
        videoPath = undefined;
      }

      // 2. Kick off analysis instantly without waiting for the video
      console.log("[ReviewScreen] ▶ Step 4: Dispatching POST /analyze to FastAPI backend...");
      const report = await postAnalyze({
        audioBlob: result.audioBlob,
        frameData: { mediapipeReady: ready, frameAnalysis: fa },
        topic: result.topic || undefined,
        video_url: videoPath,
      });
      console.log("[ReviewScreen] ✔ Step 5: Backend /analyze responded successfully!");
      setBackendReport(report);
      setBackendStatus("done");
    } catch (err) {
      console.error("[ReviewScreen] ✖ Backend call failed:", err);
      setBackendError(
        err instanceof Error
          ? err.message
          : "Could not connect to FastAPI server.",
      );
      setBackendStatus("error");
    }
  };

  const hasStartedRef = useRef(false);

  // Automatically start analysis when landing on Review screen
  useEffect(() => {
    if (!hasStartedRef.current && analysisStatus === "idle" && result) {
      hasStartedRef.current = true;
      handleAnalyze();
    }
  }, [result, analysisStatus]);

  return (
    <div className="min-h-screen animate-fade-in bg-[#FFFFFF] text-[#17181C] px-4 sm:px-8 py-8">
      <div className="max-w-[1440px] mx-auto space-y-6">
        {/* Navigation header (Sticky so it stays visible during scroll) */}
        <div className="sticky top-4 z-40 flex items-center justify-between bg-white/95 backdrop-blur-md rounded-2xl p-3.5 sm:p-4 shadow-sm border border-[#17181C]/10">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="inline-flex items-center gap-1.5 text-xs text-[#6B6D76] font-semibold hover:text-[#17181C] transition-colors bg-white hover:bg-[#17181C]/5 border border-[#17181C]/10 px-3.5 py-1.5 rounded-full cursor-pointer"
              aria-label="Back to Studio"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 19.5L8.25 12l7.5-7.5"
                />
              </svg>
              <span>Back to Studio</span>
            </button>
            <div>
              <h1 className="text-base font-bold text-[#17181C] tracking-tight flex items-center gap-2">
                <span>VakSutra AI Diagnostic Console</span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#7A2D3B]/10 text-[#7A2D3B] border border-[#7A2D3B]/20 font-sans leading-none">
                  Beta
                </span>
              </h1>
              <p className="text-[11px] text-[#8B8C93]">
                Session telemetry and AI coaching breakdown
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-block text-xs font-semibold text-[#7A2D3B] bg-[#7A2D3B]/12 px-3.5 py-1.5 rounded-full border border-[#7A2D3B]/25 font-mono">
              Session Review
            </span>
            <button
              onClick={onBack}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#6B6D76] hover:text-[#17181C] bg-[#17181C]/5 hover:bg-[#17181C]/10 border border-[#17181C]/10 px-3 py-1.5 rounded-full cursor-pointer transition-all"
              title="Close and exit to Studio"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span>Exit</span>
            </button>
          </div>
        </div>

        {/* Main 2-Column Split Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column (Video + Telemetry, lg:col-span-5) */}
          <div className="lg:col-span-5 lg:sticky lg:top-6 space-y-6">
            {/* Video Player Container (Mirrored Video with Clean Non-Inverted Controls) */}
            <div className="rounded-2xl overflow-hidden bg-[#17181C] aspect-video shadow-md relative group border border-[#17181C]/10 flex flex-col justify-between select-none">
              {videoUrl && (
                <video
                  ref={videoRef}
                  src={videoUrl}
                  playsInline
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleLoadedMetadata}
                  onEnded={() => {
                    setIsPlaying(false);
                    setCurrentTime(effectiveDuration);
                  }}
                  onClick={togglePlay}
                  className="w-full h-full object-contain transform -scale-x-100 cursor-pointer"
                  aria-label="Recorded session playback"
                />
              )}

              {/* Big Play Button Overlay on Pause */}
              {!isPlaying && (
                <div
                  onClick={togglePlay}
                  className="absolute inset-0 flex items-center justify-center bg-black/25 cursor-pointer transition-opacity group-hover:bg-black/35"
                >
                  <div className="w-14 h-14 rounded-full bg-[#17181C]/85 text-white flex items-center justify-center backdrop-blur-md border border-white/20 shadow-xl hover:scale-105 active:scale-95 transition-transform">
                    <svg className="w-6 h-6 ml-0.5 text-[#FFFFFF]" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </div>
              )}

              {/* Custom Non-Flipped Sleek Control Bar */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-3 pt-6 flex flex-col gap-1.5 transition-opacity opacity-90 group-hover:opacity-100">
                {/* Seek Bar */}
                <input
                  type="range"
                  min={0}
                  max={effectiveDuration}
                  step={0.05}
                  value={Math.min(currentTime, effectiveDuration)}
                  onChange={handleSeek}
                  className="w-full h-1.5 bg-white/25 rounded-lg appearance-none cursor-pointer accent-[#7A2D3B]"
                />

                <div className="flex items-center justify-between text-white text-xs font-mono pt-1">
                  <div className="flex items-center gap-3">
                    {/* Clear prominent Play/Pause button */}
                    <button
                      type="button"
                      onClick={togglePlay}
                      className="w-7 h-7 rounded-full bg-white/15 hover:bg-[#7A2D3B] text-white flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-90"
                      aria-label={isPlaying ? "Pause" : "Play"}
                    >
                      {isPlaying ? (
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                        </svg>
                      ) : (
                        <svg className="w-3.5 h-3.5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      )}
                    </button>

                    {/* Mute button */}
                    <button
                      type="button"
                      onClick={toggleMute}
                      className="w-7 h-7 rounded-full hover:bg-white/10 text-white/80 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                      aria-label="Toggle mute"
                    >
                      {isMuted ? (
                        <svg className="w-4 h-4 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75L19.5 12m0 0l2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6.75L9 9H5.25A2.25 2.25 0 003 11.25v1.5A2.25 2.25 0 005.25 15H9l4.5 4.5V4.5z" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.757 3.63 8.25 4.51 8.25H6.75z" />
                        </svg>
                      )}
                    </button>

                    <span className="text-[11px] text-white/90 font-medium">
                      {formatDurationSec(currentTime)} / {formatDurationSec(effectiveDuration)}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={toggleFullScreen}
                    className="w-7 h-7 rounded-full hover:bg-white/10 text-white/80 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                    aria-label="Fullscreen"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {result && (
              <div className="grid grid-cols-3 gap-3">
                <InfoTile
                  label="Duration"
                  value={formatDuration(result.durationMs)}
                />
                <InfoTile
                  label="Video File"
                  value={formatFileSize(result.videoBlob.size)}
                />
                <InfoTile
                  label="Audio Stream"
                  value={formatFileSize(result.audioBlob.size)}
                />
              </div>
            )}

            {/* Action Buttons Toolbar */}
            <div className="bg-white rounded-2xl p-2 border border-[#17181C]/8 shadow-xs flex flex-col sm:flex-row items-center gap-2">
              {!initialReport && (
                <>


                  {onRetry && (
                    <button
                      id="retry-btn"
                      onClick={onRetry}
                      className="w-full sm:flex-1 py-2.5 px-4 rounded-full bg-[#FFFFFF] hover:bg-[#17181C]/5 text-[#17181C] border border-[#17181C]/10 hover:border-[#17181C]/20 font-semibold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <svg className="w-3.5 h-3.5 text-[#6B6D76]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15a3 3 0 01-3-3V4.5a3 3 0 116 0v7.5a3 3 0 01-3 3z" />
                      </svg>
                      <span>Try Again</span>
                    </button>
                  )}
                </>
              )}

              <button
                id="finish-btn"
                onClick={onBack}
                className="w-full sm:flex-1 py-2.5 px-5 rounded-full bg-[#17181C] hover:bg-[#2b2c31] font-semibold text-xs text-white transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                title="Finish review and return to Studio"
              >
                <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                <span>Finish &amp; Exit</span>
              </button>
            </div>

            {analysisStatus === "running" && (
              <div className="mt-4">
                <div className="h-1.5 bg-[#17181C]/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#7A2D3B] transition-all duration-200 linear rounded-full"
                    style={{ width: `${analysisProgress}%` }}
                  />
                </div>
              </div>
            )}

            {analysisStatus === "error" && (
              <p className="mt-4 text-xs text-[#C1373A] text-center font-bold">
                {analysisError}
              </p>
            )}

            {visualWarning && (
              <p className="mt-4 text-xs text-[#8a6d3b] bg-[#fdf6e3] border border-[#e0c98a]/50 rounded-xl px-3 py-2 text-center leading-relaxed">
                {visualWarning}
              </p>
            )}

            {/* Scored Telemetry — below the video, in the left column.
                Rendered directly here (not inside BackendReport) so it stays
                exactly as fast as it's always been: available the instant
                on-device analysis finishes, independent of the backend
                round-trip the rest of the report waits on. */}
            {mediapipeReady && frameAnalysis.length > 0 && (
              <ScoredTelemetryPanel frameAnalysis={frameAnalysis} />
            )}

          </div>

          {/* Right Column (Diagnostic Report & Telemetry, lg:col-span-7) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Transcript (Right Column, top) */}
            {backendReport?.transcript && (
              <HighlightedTranscript
                text={backendReport.transcript}
                fillerWords={backendReport.linguistic_stats?.filler_words_found}
              />
            )}

            <BackendReport
              status={backendStatus}
              report={backendReport}
              error={backendError}
              onRetry={handleAnalyze}
              onSeek={(timeMs) => {
                if (videoRef.current) {
                  videoRef.current.currentTime = timeMs / 1000;
                  videoRef.current
                    .play()
                    .catch((e) => console.error("Play failed:", e));
                  videoRef.current.scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                  });
                }
              }}
            />

            {/* Rate this session — shown once results are in */}
            {backendStatus === "done" && (
              <div className="rounded-2xl border border-[#7A2D3B]/20 bg-gradient-to-br from-[#7A2D3B]/5 to-[#7A2D3B]/10 p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-[#17181C]">How was this session?</p>
                  <p className="text-xs text-[#6B6D76] mt-0.5">Your feedback directly shapes VakSutra AI — takes 30 seconds.</p>
                </div>
                <button
                  id="rate-session-btn"
                  onClick={() => setShowFeedbackModal(true)}
                  className="shrink-0 inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#7A2D3B] hover:bg-[#63202C] text-white text-sm font-semibold shadow-md hover:shadow-lg transition-all cursor-pointer active:scale-95"
                >
                  <span>💬</span>
                  <span>Rate this Session</span>
                </button>
              </div>
            )}

            {showFeedbackModal && (
              <BetaFeedbackModal onClose={() => setShowFeedbackModal(false)} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}