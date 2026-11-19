"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

interface TopicScreenProps {
  initialTopic?: string;
  onStart: (topic: string) => void;
  onBack: () => void;
  mode?: string;
}

const PREP_DURATION = 3; // 3 seconds topic preview before camera studio launch

// Shown while the LLM is generating a topic
const LOADING_PLACEHOLDER = "Generating your speech topic...";

export default function TopicScreen({
  initialTopic,
  onStart,
  onBack,
  mode = "impromptu",
}: TopicScreenProps) {
  const [topic, setTopic] = useState(initialTopic || LOADING_PLACEHOLDER);
  const [isLoading, setIsLoading] = useState(!initialTopic);
  const [timeLeft, setTimeLeft] = useState(PREP_DURATION);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  // ── Fetch a new topic from the backend ─────────────────────────────────────
  const fetchTopic = useCallback(
    async (resetTimer = true) => {
      setIsLoading(true);
      if (resetTimer) {
        setIsTimerRunning(false);
        setTimeLeft(PREP_DURATION);
      }

      try {
        const fullUrl = `${API_BASE}/topics/generate?mode=${mode}`;
        const { fetchWithAuth } = await import("@/lib/auth");

        const res = await fetchWithAuth(fullUrl, { cache: "no-store" });

        if (!res.ok) throw new Error(`HTTP ${res.status} from ${fullUrl}`);
        const data = await res.json();

        setTopic(data.topic);
        setIsTimerRunning(true);
      } catch (err) {
        console.error("[TopicScreen] Topic generation failed:", err);
        // Fallback: show a safe general topic so the user can still practice
        setTopic("Talk about something you are genuinely passionate about and why it matters to you.");
        setIsTimerRunning(true);
      } finally {
        setIsLoading(false);
      }
    },
    [mode]
  );

  // Fetch on mount (unless a pre-set topic was passed in)
  const hasFetchedRef = useRef(false);
  useEffect(() => {
    if (!initialTopic && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchTopic();
    } else if (initialTopic) {
      setIsTimerRunning(true);
    }
  }, [initialTopic, fetchTopic]);

  // ── Countdown timer ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isTimerRunning || isLoading) return;

    if (timeLeft <= 0) {
      onStart(topic);
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, isTimerRunning, isLoading, topic, onStart]);

  const handleShuffle = () => {
    fetchTopic(true);
  };

  const handleStartNow = () => {
    setIsTimerRunning(false);
    onStart(topic);
  };

  const progressPct = ((PREP_DURATION - timeLeft) / PREP_DURATION) * 100;
  const cleanTopic = topic.replace(/^["'“”‘’«»]+|["'“”‘’«»]+$/g, "").trim();

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#17181C] flex flex-col items-center justify-center px-4 sm:px-6 py-12 relative overflow-hidden animate-fade-in">
      {/* Subtle ambient lighting */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-[#7A2D3B]/[0.03] rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-[#B5602F]/[0.03] rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-xl relative z-10">
        {/* Back Button */}
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-semibold text-[#6B6D76] hover:text-[#17181C] transition-all bg-white border border-[#17181C]/[0.08] px-4 py-2 rounded-full mb-5 hover:shadow-xs cursor-pointer shadow-[0_2px_6px_rgba(0,0,0,0.02)]"
        >
          <span>←</span>
          <span>Back to Studio</span>
        </button>

        {/* Studio Prep Card */}
        <div
          className="bg-white rounded-3xl p-6 sm:p-8 space-y-6 border border-[#17181C]/[0.08]"
          style={{ boxShadow: "0 24px 60px -24px rgba(23,24,28,0.12)" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#17181C]/[0.06] pb-4 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-[#7A2D3B] animate-pulse" />
              <span className="font-mono text-xs uppercase font-bold text-[#7A2D3B] tracking-widest">
                01 // IMPROMPTU PREPARATION
              </span>
            </div>
            <span className="text-[11px] font-mono text-[#17181C] bg-[#F6F6F7] px-3 py-1 rounded-full font-semibold border border-[#17181C]/[0.06]">
              {isLoading
                ? "GENERATING..."
                : `AUTO-START IN ${timeLeft}s`}
            </span>
          </div>

          {/* Topic Display */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-[10px] font-mono text-[#8B8C93] uppercase tracking-wider font-bold">
                Speech Topic
              </h2>
              <button
                onClick={handleShuffle}
                disabled={isLoading}
                className="text-xs font-semibold text-[#7A2D3B] hover:text-[#9B384A] bg-[#7A2D3B]/[0.06] hover:bg-[#7A2D3B]/[0.1] px-3 py-1 rounded-full transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span className={isLoading ? "animate-spin" : ""}>↻</span>
                <span>{isLoading ? "Generating..." : "Shuffle Topic"}</span>
              </button>
            </div>

            <div
              className={`text-lg sm:text-xl font-bold text-[#17181C] leading-snug bg-gradient-to-br from-[#FAFAFA] to-[#F5F5F6] p-6 sm:p-7 rounded-2xl border border-[#17181C]/[0.06] min-h-[100px] flex items-center transition-opacity duration-300 shadow-2xs ${
                isLoading ? "opacity-40" : "opacity-100"
              }`}
            >
              {isLoading ? (
                <span className="animate-pulse text-[#8B8C93] text-base italic flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-[#7A2D3B] border-t-transparent rounded-full animate-spin inline-block" />
                  Generating a fresh prompt...
                </span>
              ) : (
                <span>&ldquo;{cleanTopic}&rdquo;</span>
              )}
            </div>
          </div>

          {/* Countdown Progress Bar */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between text-xs text-[#6B6D76] font-mono">
              <span>Auto-starting recording</span>
              <span className="text-[#7A2D3B] font-bold">{timeLeft}s remaining</span>
            </div>
            <div className="h-1.5 bg-[#17181C]/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#7A2D3B] transition-all duration-1000 ease-linear rounded-full"
                style={{ width: isLoading ? "0%" : `${progressPct}%` }}
              />
            </div>
          </div>

          {/* Action Button */}
          <button
            onClick={handleStartNow}
            disabled={isLoading}
            className="w-full bg-[#17181C] hover:bg-[#2b2c31] text-white text-sm py-4 rounded-full flex items-center justify-center gap-2 font-bold cursor-pointer transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>Start Practice Session Now</span>
            <span className="text-xs">→</span>
          </button>
        </div>
      </div>
    </div>
  );
}