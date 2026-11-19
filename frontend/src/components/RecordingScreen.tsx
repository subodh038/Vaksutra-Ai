"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { RecordingResult } from "@/app/page";

interface RecordingScreenProps {
  topic: string;
  onDone: (result: RecordingResult) => void;
  onBack: () => void;
}

type RecordingState = "requesting" | "countdown" | "recording" | "stopping" | "error_permission" | "error_unsupported";

const MAX_RECORDING_MS = 120000; // 2 minutes auto-cutoff
const WRAP_UP_CUE_MS = 10000; // show the "wrap up" cue during the final 10 seconds

function formatDuration(ms: number): string {
  if (!isFinite(ms) || isNaN(ms) || ms < 0) return "00:00";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

export default function RecordingScreen({ topic, onDone, onBack }: RecordingScreenProps) {
  const [state, setState] = useState<RecordingState>("requesting");
  const [countdown, setCountdown] = useState<number>(10);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [elapsedMs, setElapsedMs] = useState<number>(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRecorderRef = useRef<MediaRecorder | null>(null);
  const videoChunksRef = useRef<Blob[]>([]);
  const audioChunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopStream = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  }, []);

  const stopCountdownTimer = useCallback(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, []);

  const handleStopRef = useRef<() => void>(() => {});

  const stopTimer = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }, []);

  const handleStop = useCallback(() => {
    if (state !== "recording" || !mediaRecorderRef.current || !audioRecorderRef.current) return;

    setState("stopping");
    stopTimer();

    const videoRecorder = mediaRecorderRef.current;
    const audioRecorder = audioRecorderRef.current;
    let videoDone = false;
    let audioDone = false;

    const checkDone = () => {
      if (videoDone && audioDone) {
        const finalDuration = Math.min(MAX_RECORDING_MS, Date.now() - startTimeRef.current);
        const videoBlob = new Blob(videoChunksRef.current, { type: "video/webm" });
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm;codecs=opus" });

        stopStream();

        onDone({
          videoBlob,
          audioBlob,
          durationMs: finalDuration,
          topic,
        });
      }
    };

    videoRecorder.onstop = () => {
      videoDone = true;
      checkDone();
    };

    audioRecorder.onstop = () => {
      audioDone = true;
      checkDone();
    };

    videoRecorder.stop();
    audioRecorder.stop();
  }, [state, stopTimer, stopStream, onDone, topic]);

  useEffect(() => {
    handleStopRef.current = handleStop;
  }, [handleStop]);

  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now();
    timerIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      if (elapsed >= MAX_RECORDING_MS) {
        setElapsedMs(MAX_RECORDING_MS);
        handleStopRef.current();
      } else {
        setElapsedMs(elapsed);
      }
    }, 200);
  }, []);

  const handleStartNow = useCallback(() => {
    if (state !== "countdown" || !mediaRecorderRef.current) return;
    stopCountdownTimer();
    try {
      mediaRecorderRef.current.start(500);
      if (audioRecorderRef.current) {
        audioRecorderRef.current.start(500);
      }
      startTimer();
      setState("recording");
    } catch (e) {
      console.error("Start recording error:", e);
    }
  }, [state, stopCountdownTimer, startTimer]);

  // Main recorder initialization
  useEffect(() => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setState("error_unsupported");
      return;
    }

    let isMounted = true;

    async function initMedia() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
          audio: { echoCancellation: true, noiseSuppression: true },
        });

        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        mediaStreamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(e => console.error("Play video failed:", e));
        }

        // Prefer VP9 (better compression); fall back to VP8/generic webm
        const vp9Mime = "video/webm;codecs=vp9,opus";
        const vp8Mime = "video/webm;codecs=vp8,opus";
        const videoMime = MediaRecorder.isTypeSupported(vp9Mime)
          ? vp9Mime
          : MediaRecorder.isTypeSupported(vp8Mime)
          ? vp8Mime
          : "video/webm";

        const videoRecorder = new MediaRecorder(stream, {
          mimeType: videoMime,
          videoBitsPerSecond: 400_000,  // 400 Kbps — ~3 MB/min (was ~26 MB/min)
          audioBitsPerSecond: 64_000,   // 64 Kbps opus
        });

        
        // Isolate audio track for small payload size
        const audioTrack = stream.getAudioTracks()[0];
        const audioStream = new MediaStream([audioTrack]);
        const audioRecorder = new MediaRecorder(audioStream, { mimeType: "audio/webm;codecs=opus" });
        
        mediaRecorderRef.current = videoRecorder;
        audioRecorderRef.current = audioRecorder;
        
        videoChunksRef.current = [];
        audioChunksRef.current = [];

        videoRecorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            videoChunksRef.current.push(e.data);
          }
        };

        audioRecorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            audioChunksRef.current.push(e.data);
          }
        };

        setState("countdown");
        // Camera prep window before live recording starts
        setCountdown(10);

        let currentCount = 10;
        countdownIntervalRef.current = setInterval(() => {
          currentCount -= 1;
          if (currentCount > 0) {
            setCountdown(currentCount);
          } else {
            stopCountdownTimer();
            if (isMounted && mediaRecorderRef.current && audioRecorderRef.current) {
              try {
                mediaRecorderRef.current.start(500);
                audioRecorderRef.current.start(500);
                startTimer();
                setState("recording");
              } catch (e) {
                console.error("Auto-start error:", e);
              }
            }
          }
        }, 1000);
      } catch (err: unknown) {
        if (!isMounted) return;
        console.error("Camera access error:", err);
        const message = err instanceof Error ? err.message : "Camera or Microphone permission denied.";
        setErrorMsg(message);
        setState("error_permission");
      }
    }

    initMedia();

    return () => {
      isMounted = false;
      stopCountdownTimer();
      stopTimer();
      stopStream();
    };
  }, [startTimer, stopTimer, stopStream, stopCountdownTimer]);

  if (state === "error_unsupported") {
    return (
      <ErrorCard
        title="Browser Unsupported"
        message="Your browser does not support high-precision video recording. Please try Chrome, Edge, or Firefox."
        onBack={onBack}
      />
    );
  }

  if (state === "error_permission") {
    return (
      <ErrorCard
        title="Camera & Microphone Access Needed"
        message={
          errorMsg ||
          "VakSutra AI requires camera and microphone permissions to analyze your delivery and gaze contact."
        }
        onBack={onBack}
      />
    );
  }

  return (
    <div className="min-h-screen bg-white text-[#17181C] flex flex-col justify-between px-4 sm:px-6 py-6 animate-fade-in selection:bg-[#7A2D3B]/15">

      {/* ── TOP FLOATING CONTROL BAR ─────────────────────────── */}
      <header className="max-w-4xl w-full mx-auto flex items-center justify-between py-2">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-medium text-[#6B6D76] hover:text-[#17181C] transition-all bg-white border border-[#17181C]/10 px-4 py-2 rounded-full hover:shadow-sm cursor-pointer"
          aria-label="Cancel session"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
          <span>Cancel Session</span>
        </button>

        {/* State Indicator */}
        <div>
          {state === "countdown" && (
            <div className="inline-flex items-center gap-2 text-xs font-mono font-semibold text-[#7A2D3B] bg-[#7A2D3B]/10 border border-[#7A2D3B]/25 px-3.5 py-1.5 rounded-full">
              <span className="w-2 h-2 rounded-full bg-[#7A2D3B] animate-ping" />
              <span>PREP MODE ({countdown}s)</span>
            </div>
          )}

          {state === "recording" && (
            <div className="inline-flex items-center gap-2 text-xs font-mono font-semibold text-[#C1373A] bg-[#C1373A]/10 border border-[#C1373A]/25 px-3.5 py-1.5 rounded-full">
              <span className="w-2 h-2 rounded-full bg-[#C1373A] animate-pulse" />
              <span>RECORDING LIVE</span>
            </div>
          )}

          {state === "requesting" && (
            <div className="inline-flex items-center gap-2 text-xs font-mono font-medium text-[#6B6D76] bg-white border border-[#17181C]/10 px-3.5 py-1.5 rounded-full">
              <span className="w-2 h-2 rounded-full bg-[#7A2D3B] animate-pulse" />
              <span>CONNECTING CAMERA</span>
            </div>
          )}

          {state === "stopping" && (
            <div className="inline-flex items-center gap-2 text-xs font-mono font-medium text-[#7A2D3B] bg-[#7A2D3B]/10 border border-[#7A2D3B]/25 px-3.5 py-1.5 rounded-full">
              <span className="w-2 h-2 rounded-full bg-[#7A2D3B] animate-pulse" />
              <span>PROCESSING AUDIO &amp; VIDEO</span>
            </div>
          )}
        </div>
      </header>

      {/* ── MAIN STUDIO STAGE ───────────────────────────── */}
      <main className="max-w-3xl w-full mx-auto my-auto py-4 flex flex-col items-center">

        {/* Topic Prompt Card */}
        <div
          className="w-full bg-white rounded-2xl p-6 border border-[#17181C]/[0.08] mb-6 relative overflow-hidden"
          style={{ boxShadow: "0 12px 32px -16px rgba(23,24,28,0.14)" }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-[#7A2D3B] uppercase font-mono font-bold tracking-[0.2em]">
              PROMPT // IMPROMPTU DRILL
            </span>
            {state === "countdown" && (
              <span className="text-[10px] font-mono text-[#7A2D3B] bg-[#7A2D3B]/10 px-2 py-0.5 rounded-full font-semibold">
                Auto-start in {countdown}s
              </span>
            )}
          </div>
          <p className="text-lg sm:text-xl font-semibold text-[#17181C] leading-relaxed">
            &ldquo;{topic.replace(/^["'“”‘’«»]+|["'“”‘’«»]+$/g, "").trim()}&rdquo;
          </p>
        </div>

        {/* Camera Stage Viewport */}
        <div
          className="w-full relative rounded-3xl overflow-hidden bg-[#0B0B0F] aspect-video border border-[#17181C]/15 mb-6"
          style={{ boxShadow: "0 32px 70px -20px rgba(23,24,28,0.35)" }}
        >
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover transform -scale-x-100"
            aria-label="Live camera preview"
          />

          {/* Countdown Overlay */}
          {state === "countdown" && (
            <div className="absolute inset-0 bg-[#0B0B0F]/80 backdrop-blur-sm flex flex-col items-center justify-center text-center p-6 transition-all z-20">
              <div className="font-mono text-xs text-[#E8A6B4] font-bold uppercase tracking-widest mb-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#E8A6B4] animate-ping" />
                <span>Starting Camera ({countdown}s)</span>
              </div>
              <div
                key={countdown}
                className="text-7xl sm:text-9xl font-bold text-white my-1 animate-fade-in"
                style={{ textShadow: "0 12px 24px rgba(0,0,0,0.6)" }}
              >
                {countdown}
              </div>
              <p className="text-xs text-[#A0A0A8] max-w-sm mt-1 mb-4 leading-relaxed">
                Recording starts automatically.
              </p>
              <button
                type="button"
                onClick={handleStartNow}
                className="bg-white text-[#17181C] px-6 py-2.5 rounded-full text-xs font-bold cursor-pointer hover:bg-[#F0F0F0] transition-colors flex items-center gap-2"
              >
                <span>Start Speaking Now →</span>
              </button>
            </div>
          )}

          {/* Live Recording HUD Header */}
          {state === "recording" && (() => {
            const remainingMs = Math.max(0, MAX_RECORDING_MS - elapsedMs);
            const progress = Math.min(1, elapsedMs / MAX_RECORDING_MS);
            const RING_R = 8;
            const RING_CIRC = 2 * Math.PI * RING_R;
            const isFinalStretch = remainingMs > 0 && remainingMs <= WRAP_UP_CUE_MS;
            return (
              <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none">
                {/* Elapsed / limit pill with progress ring */}
                <div
                  className={`flex items-center gap-2 backdrop-blur-md rounded-full px-3.5 py-1.5 text-xs font-mono border transition-colors ${
                    isFinalStretch
                      ? "bg-[#C1373A]/80 border-[#FCA5A5]/50"
                      : "bg-black/60 border-white/10"
                  }`}
                >
                  <svg width="18" height="18" viewBox="0 0 20 20" className="-rotate-90 shrink-0">
                    <circle cx="10" cy="10" r={RING_R} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="3" />
                    <circle
                      cx="10"
                      cy="10"
                      r={RING_R}
                      fill="none"
                      stroke={isFinalStretch ? "#FCA5A5" : "#E8747A"}
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeDasharray={`${progress * RING_CIRC} ${RING_CIRC}`}
                    />
                  </svg>
                  <span className={`font-bold ${isFinalStretch ? "text-[#FCA5A5]" : "text-white"}`}>
                    {formatDuration(elapsedMs)}
                  </span>
                  <span className="text-white/40">/ {formatDuration(MAX_RECORDING_MS)}</span>
                </div>

                {/* Final-stretch wrap-up cue */}
                {isFinalStretch && (
                  <div className="flex items-center gap-2 bg-[#C1373A] backdrop-blur-md border border-white/25 rounded-full px-3.5 py-1.5 text-xs font-mono font-bold text-white shadow-lg animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                    <span>{Math.ceil(remainingMs / 1000)}s LEFT — WRAP UP!</span>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Connecting State */}
          {state === "requesting" && (
            <div className="absolute inset-0 bg-[#0B0B0F]/95 flex flex-col items-center justify-center">
              <div className="w-9 h-9 rounded-full border-2 border-[#E8A6B4] border-t-transparent animate-spin mb-3" />
              <p className="text-xs font-semibold text-white/90">Connecting to Camera &amp; Audio…</p>
            </div>
          )}

          {/* Finalizing State */}
          {state === "stopping" && (
            <div className="absolute inset-0 bg-[#0B0B0F]/95 flex flex-col items-center justify-center">
              <div className="w-9 h-9 rounded-full border-2 border-[#E8A6B4] border-t-transparent animate-spin mb-3" />
              <p className="text-xs font-semibold text-white/90">Analyzing Speech &amp; Delivery Telemetry…</p>
            </div>
          )}
        </div>

        {/* ── BOTTOM ACTION CONTROL ───────────────────────────── */}
        <div className="flex flex-col items-center gap-3 w-full">
          {state === "countdown" ? (
            <button
              onClick={handleStartNow}
              className="bg-[#17181C] text-white py-3.5 px-8 rounded-full font-semibold text-sm transition-colors flex items-center justify-center gap-2.5 cursor-pointer hover:bg-[#2b2c31]"
            >
              <span>Start Recording Now ({countdown}s) →</span>
            </button>
          ) : (
            <button
              id="stop-recording-btn"
              onClick={handleStop}
              disabled={state !== "recording"}
              className={`py-3.5 px-8 rounded-full font-semibold text-sm transition-colors flex items-center justify-center gap-2.5 ${
                state === "recording"
                  ? "bg-[#C1373A] hover:bg-[#A62F31] text-white cursor-pointer"
                  : "bg-white border border-[#17181C]/10 text-[#8B8C93] cursor-not-allowed"
              }`}
            >
              {state === "recording" && <span className="w-2.5 h-2.5 rounded-xs bg-white" />}
              <span>
                {state === "recording"
                  ? "Finish & Analyze Session →"
                  : "Initializing Studio…"}
              </span>
            </button>
          )}

          <p className="text-[11px] text-[#8B8C93] font-mono">
            {state === "recording"
              ? "Speak naturally. Session auto-ends at 02:00. Click when finished to generate your speech diagnostic report."
              : state === "countdown"
              ? "Click 'Start Speaking Now' whenever you're ready, or wait for the timer."
              : "On-device processing • Privacy protected"}
          </p>
        </div>

      </main>

      {/* ── FOOTER BAR ───────────────────────────────── */}
      <footer className="max-w-4xl w-full mx-auto text-center py-2">
        <span className="text-[11px] text-[#8B8C93] font-mono">
          VakSutra AI Studio [Beta] // Real-Time Speech Analytics
        </span>
      </footer>
    </div>
  );
}

function ErrorCard({
  title,
  message,
  onBack,
}: {
  title: string;
  message: string;
  onBack: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-white text-[#17181C] animate-fade-in">
      <div
        className="max-w-md w-full bg-white rounded-3xl border border-[#17181C]/[0.08] p-8 text-center space-y-6"
        style={{ boxShadow: "0 24px 60px -24px rgba(23,24,28,0.18)" }}
      >
        <div className="w-12 h-12 rounded-2xl bg-[#C1373A]/10 text-[#C1373A] flex items-center justify-center mx-auto text-xl">
          ⚠️
        </div>
        <div>
          <h2 className="text-xl font-bold text-[#17181C] mb-2">{title}</h2>
          <p className="text-xs text-[#6B6D76] leading-relaxed">{message}</p>
        </div>

        <div className="space-y-2 pt-2">
          <button
            onClick={onBack}
            className="w-full py-3 rounded-full text-xs font-semibold border border-[#17181C]/15 bg-white text-[#6B6D76] hover:bg-[#17181C]/5 transition-colors cursor-pointer"
          >
            Return to Modules
          </button>
        </div>
      </div>
    </div>
  );
}