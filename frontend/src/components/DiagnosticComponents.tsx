"use client";
import React, { useState, useEffect, useRef } from "react";
import type {
  AcousticStats,
  AnalysisResponse,
  BeforeAfterCorrection,
  CoachingReport,
  DerivedInsights,
  LinguisticStats,
} from "@/lib/api";
import type { FrameAnalysisEntry } from "@/lib/videoAnalysis";

export function formatDuration(ms: number): string {
  if (!isFinite(ms) || isNaN(ms) || ms < 0) return "--:--";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

export function formatDurationSec(sec: number): string {
  if (!isFinite(sec) || isNaN(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatWordCounts(words: string[] | undefined | null): string {
  if (!words || words.length === 0) return "0";
  const count = words.length;
  const list = words.slice(0, 3).join(", ");
  return `${count} (${list}${count > 3 ? ", ..." : ""})`;
}

// Values ReviewScreen actually passes — kept in ONE place to avoid the
// divergent duplicate definitions that caused type mismatches.
export type BackendStatus = "idle" | "sending" | "done" | "error";

export function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl p-3.5 text-center border border-slate-200 shadow-sm">
      <p className="text-[10px] font-mono text-slate-500 font-bold uppercase mb-1">
        {label}
      </p>
      <p className="text-xs font-extrabold font-mono text-slate-900">{value}</p>
    </div>
  );
}

// ─── Score Circle ─────────────────────────────────────────────────────────────

export function ScoreCircle({ score }: { score: number }) {
  const color =
    score >= 75
      ? "text-emerald-700 border-emerald-500 bg-emerald-50"
      : score >= 50
        ? "text-amber-700 border-amber-500 bg-amber-50"
        : "text-rose-700 border-rose-500 bg-rose-50";
  return (
    <div
      className={`w-16 h-16 rounded-full border-2 flex items-center justify-center ${color} shadow-sm`}
    >
      <span className="text-xl font-black font-mono">{Math.round(score)}</span>
    </div>
  );
}

// ─── Metric Card Helper ──────────────────────────────────────────────────────

export function MetricCard({
  icon,
  color,
  title,
  value,
  status,
  progress,
  layout = "horizontal",
  isGrouped = false,
}: {
  icon: React.ReactNode;
  color: string;
  title: string;
  value: string | number;
  status: string;
  progress?: number;
  layout?: "horizontal" | "vertical";
  isGrouped?: boolean;
}) {
  const colorMap = {
    teal: { bg: "bg-teal-50", text: "text-teal-600", bar: "bg-teal-500" },
    amber: { bg: "bg-amber-50", text: "text-amber-600", bar: "bg-amber-500" },
    rose: { bg: "bg-rose-50", text: "text-rose-600", bar: "bg-rose-500" },
    purple: {
      bg: "bg-purple-50",
      text: "text-purple-600",
      bar: "bg-purple-500",
    },
    blue: { bg: "bg-blue-50", text: "text-blue-600", bar: "bg-blue-500" },
    orange: {
      bg: "bg-orange-50",
      text: "text-orange-600",
      bar: "bg-orange-500",
    },
    pink: { bg: "bg-pink-50", text: "text-pink-600", bar: "bg-pink-500" },
  } as Record<string, { bg: string; text: string; bar: string }>;

  const c = colorMap[color] || colorMap.teal;

  const gradientMap = {
    teal: "from-teal-50 to-teal-100/60",
    amber: "from-amber-50 to-amber-100/60",
    rose: "from-rose-50 to-rose-100/60",
    purple: "from-purple-50 to-purple-100/60",
    blue: "from-blue-50 to-blue-100/60",
    orange: "from-orange-50 to-orange-100/60",
    pink: "from-pink-50 to-pink-100/60",
  } as Record<string, string>;
  const g = gradientMap[color] || gradientMap.teal;

  if (layout === "vertical") {
    return (
      <div className="flex flex-col gap-3 bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow h-full">
        <div className="flex items-start justify-between">
          <div
            className={`w-11 h-11 rounded-full bg-gradient-to-br ${g} flex items-center justify-center shrink-0`}
          >
            <svg
              className={`w-5 h-5 ${c.text}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              {icon}
            </svg>
          </div>
          <span
            className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${c.bg} ${c.text}`}
          >
            {status}
          </span>
        </div>
        <div className="mt-1">
          <h4 className="text-[12px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            {title}
          </h4>
          <div className="text-3xl font-black text-slate-900 leading-none">
            {value}
          </div>
        </div>
        {progress !== undefined && (
          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden mt-2">
            <div
              className={`h-full ${c.bar} rounded-full transition-all duration-500`}
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
        )}
      </div>
    );
  }

  const containerClasses = isGrouped
    ? "flex items-center gap-4 p-4 hover:bg-slate-50/60 transition-colors"
    : "flex items-center gap-4 bg-white border border-slate-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow";

  return (
    <div className={containerClasses}>
      <div
        className={`w-12 h-12 rounded-full ${c.bg} flex items-center justify-center shrink-0`}
      >
        <svg
          className={`w-6 h-6 ${c.text}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          {icon}
        </svg>
      </div>
      <div className="flex-1">
        <h4 className="text-[15px] font-bold text-slate-900 mb-0.5">{title}</h4>
        <div
          className={`flex items-center gap-2.5 text-sm ${progress !== undefined ? "mb-2" : ""}`}
        >
          <span className="text-slate-700 font-bold">{value}</span>
          <span
            className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${c.bg} ${c.text}`}
          >
            {status}
          </span>
        </div>
        {progress !== undefined && (
          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full ${c.bar} rounded-full transition-all duration-500`}
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Score Breakdown — mirrors backend Impromptu mode compute_score() ────────

export function _linearScore(value: number, zeroAt: number, hundredAt: number): number {
  if (hundredAt === zeroAt) return 100;
  const t = (value - zeroAt) / (hundredAt - zeroAt);
  return Math.max(0, Math.min(100, t * 100));
}

export function _paceScore(wpm: number): number {
  // Mirrors backend _pace_score: sweet spot 120-160 WPM.
  if (wpm <= 0) return 0;
  if (wpm >= 120 && wpm <= 160) return 100;
  if (wpm < 120) return _linearScore(wpm, 70, 120);
  return _linearScore(wpm, 210, 160);
}

interface BreakdownMetric {
  label: string;
  rawScore: number;        // 0–100
  weight: number;          // 0–1 (of total)
  weightedScore: number;   // rawScore * weight
  color: string;           // tailwind color key
}

export function ScoreBreakdown({
  report,
  durationMs,
}: {
  report: AnalysisResponse;
  /** Real session duration — preferred over deriving it from detected events,
   *  which is 0 whenever the session produced no visual events. */
  durationMs?: number;
}) {
  const [isOpen, setIsOpen] = useState(false);

  // ── EXACT mirror of backend modes/impromptu.py compute_score() ────────────
  // Every threshold and weight below is copied 1:1 from the backend. If you
  // change scoring there, change it here too (long-term: backend should
  // expose category scores so this duplication dies).
  const em = report.emotion;
  const ac = report.acoustic_stats;
  const ls = report.linguistic_stats;
  const NEUTRAL = 65;

  const eventEndMs = report.detected_events
    ? Math.max(0, ...report.detected_events.map((e) => e.end_ms))
    : 0;
  const duration_ms = durationMs ?? eventEndMs;

  // ── 1. Verbal Fluency — weights (10,12,8,5)/35 ──────────────────
  const fillerPct    = ac ? ac.filler_word_ratio * 100 : 0;
  const fillerRaw    = ac ? _linearScore(fillerPct, 12, 2) : NEUTRAL;
  // Backend: pace = _pace_score(wpm) → hard 0 when wpm<=0.
  const paceRaw      = ac ? _paceScore(ac.wpm) : NEUTRAL;

  const duration_min   = duration_ms / 60_000.0;
  const pauses_per_min = ac && duration_min > 0 ? ac.pause_count / duration_min : 0;

  let avgPauseScore = 100;
  if (ac && ac.avg_pause_ms > 800) avgPauseScore = _linearScore(ac.avg_pause_ms, 2500, 800);
  else if (ac && ac.avg_pause_ms > 0 && ac.avg_pause_ms < 300) avgPauseScore = _linearScore(ac.avg_pause_ms, 50, 300);

  let freqScore = 100;
  if (pauses_per_min > 3.0) freqScore = _linearScore(pauses_per_min, 10, 3);

  const pauseQualityRaw = !ac || duration_ms <= 0
    ? NEUTRAL
    : 0.6 * avgPauseScore + 0.4 * freqScore;

  let articRaw = NEUTRAL;
  if (ac) {
    const rate = ac.articulation_rate;
    if (rate <= 0) articRaw = 0;
    else if (rate >= 150 && rate <= 180) articRaw = 100;
    else if (rate < 150) articRaw = _linearScore(rate, 80, 150);
    else articRaw = _linearScore(rate, 240, 180);
  }

  const fluencyScore =
    (10 / 35) * fillerRaw + (12 / 35) * paceRaw + (8 / 35) * pauseQualityRaw + (5 / 35) * articRaw;

  // ── 2. Language Quality — weights (5,5,5,5)/20 ─────────────────
  const runOnRaw = ls ? Math.max(0, 100 - 20 * ls.run_on_sentences) : NEUTRAL;

  const wordCount = report.transcript.trim().split(/\s+/).filter(Boolean).length;

  const weakPct  = ls && wordCount > 0 ? (ls.weak_words_count / wordCount) * 100 : 0;
  const weakRaw  = ls ? _linearScore(weakPct, 15, 3) : NEUTRAL;

  const repeatedCount = ls ? ls.top_repeated_words.length : 0;
  const vocabRaw = ls ? Math.max(0, 100 - repeatedCount * 25) : NEUTRAL;

  const fillerCount = ls ? ls.filler_words_found.length : 0;
  const fillerContentRatio = wordCount > 0 ? fillerCount / wordCount : 0;
  const fillerContentRaw = ls ? _linearScore(fillerContentRatio * 100, 12.5, 3.3) : NEUTRAL;

  const languageScore =
    (5 / 20) * runOnRaw + (5 / 20) * weakRaw + (5 / 20) * vocabRaw + (5 / 20) * fillerContentRaw;

  // ── 3. Vocal Delivery — weights (10,5,5)/20 ────────────────────
  let pitchRaw = NEUTRAL;
  if (ac) {
      const pv = ac.pitch_variation;
      if (pv <= 0) pitchRaw = 0;
      else if (pv >= 25 && pv <= 50) pitchRaw = 100;
      else if (pv < 25) pitchRaw = _linearScore(pv, 5, 25);
      else pitchRaw = _linearScore(pv, 90, 50);
  }

  let volRaw = NEUTRAL;
  if (ac) {
      if (ac.avg_volume < 0.005) volRaw = _linearScore(ac.avg_volume, 0.001, 0.005);
      else if (ac.avg_volume < 0.01) volRaw = _linearScore(ac.avg_volume, 0.003, 0.01);
      else volRaw = 100;
  }

  let silenceRaw = NEUTRAL;
  if (ac && duration_ms > 0) {
      const silencePct = (ac.total_pause_time_ms / duration_ms) * 100;
      if (silencePct >= 10 && silencePct <= 25) silenceRaw = 100;
      else if (silencePct < 10) silenceRaw = _linearScore(silencePct, 0, 10);
      else silenceRaw = _linearScore(silencePct, 55, 25);
  }

  const vocalScore = (10/20)*pitchRaw + (5/20)*volRaw + (5/20)*silenceRaw;

  // ── 4. Presence & Composure — weights (12,7,3,3)/25 ────────────
  // Backend uses gaze.center_pct (NOT the MediaPipe-capped avg_eye_contact)
  // and includes head pose; stress was removed as redundant with brow raise.
  const gazeCenterRaw = report.gaze.center_pct;
  const browRaiseRaw  = (1 - em.avg_brow_raise) * 100;
  const headPoseRaw   = report.head_pose.avg_head_pose * 100;
  const warmthRaw     = Math.min(em.avg_smile / 0.30, 1) * 100; // PROVISIONAL — see impromptu.py

  const presenceScore =
    (12/25)*gazeCenterRaw + (7/25)*browRaiseRaw + (3/25)*headPoseRaw + (3/25)*warmthRaw;

  // Build metric lists — labels/weights mirror backend sub-score structure
  const fluencyMetrics: BreakdownMetric[] = [
    { label: "Low Fillers", rawScore: fillerRaw, weight: 10/35, weightedScore: (10/35) * fillerRaw, color: "blue" },
    { label: `Pace (${ac?.wpm?.toFixed(0) ?? '?'} WPM)`, rawScore: paceRaw, weight: 12/35, weightedScore: (12/35) * paceRaw, color: "blue" },
    { label: "Pause Quality", rawScore: pauseQualityRaw, weight: 8/35, weightedScore: (8/35) * pauseQualityRaw, color: "blue" },
    { label: "Articulation", rawScore: articRaw, weight: 5/35, weightedScore: (5/35) * articRaw, color: "blue" },
  ];

  const languageMetrics: BreakdownMetric[] = [
    { label: "Run-on Sentences", rawScore: runOnRaw, weight: 5/20, weightedScore: (5/20) * runOnRaw, color: "purple" },
    { label: "Weak Words",       rawScore: weakRaw,  weight: 5/20, weightedScore: (5/20) * weakRaw,  color: "purple" },
    { label: "Vocabulary",       rawScore: vocabRaw, weight: 5/20, weightedScore: (5/20) * vocabRaw, color: "purple" },
    { label: "Signal-to-Noise",  rawScore: fillerContentRaw, weight: 5/20, weightedScore: (5/20) * fillerContentRaw, color: "purple" },
  ];
  
  const vocalMetrics: BreakdownMetric[] = [
    { label: "Pitch Variation", rawScore: pitchRaw, weight: 10/20, weightedScore: (10/20) * pitchRaw, color: "orange" },
    { label: "Volume",          rawScore: volRaw,   weight: 5/20, weightedScore: (5/20) * volRaw,   color: "orange" },
    { label: "Silence Ratio",   rawScore: silenceRaw, weight: 5/20, weightedScore: (5/20) * silenceRaw, color: "orange" },
  ];

  const presenceMetrics: BreakdownMetric[] = [
    { label: "Center Gaze",  rawScore: gazeCenterRaw, weight: 12/25, weightedScore: (12/25) * gazeCenterRaw, color: "teal" },
    { label: "Brow Relaxation", rawScore: browRaiseRaw, weight: 7/25, weightedScore: (7/25) * browRaiseRaw, color: "teal" },
    { label: "Head Pose",    rawScore: headPoseRaw,   weight: 3/25, weightedScore: (3/25) * headPoseRaw,   color: "teal" },
    { label: "Warmth",       rawScore: warmthRaw,     weight: 3/25, weightedScore: (3/25) * warmthRaw,     color: "teal" },
  ];

  const categories = [
    {
      name: "Verbal Fluency",
      weight: "35% weight",
      score: fluencyScore,
      metrics: fluencyMetrics,
      accent: "sage",
    },
    {
      name: "Language Quality",
      weight: "20% weight",
      score: languageScore,
      metrics: languageMetrics,
      accent: "charcoal",
    },
    {
      name: "Vocal Delivery",
      weight: "20% weight",
      score: vocalScore,
      metrics: vocalMetrics,
      accent: "gold",
    },
    {
      name: "Presence & Composure",
      weight: "25% weight",
      score: presenceScore,
      metrics: presenceMetrics,
      accent: "teal",
    },
  ];

  const themeMap: Record<
    string,
    { badge: string; text: string; fill: string; track: string; dot: string }
  > = {
    sage: {
      badge: "bg-[#7A2D3B]/12 text-[#7A2D3B] border-[#7A2D3B]/20",
      text: "text-[#7A2D3B]",
      fill: "bg-[#7A2D3B]",
      track: "bg-[#7A2D3B]/10",
      dot: "bg-[#7A2D3B]",
    },
    charcoal: {
      badge: "bg-[#17181C]/8 text-[#17181C] border-[#17181C]/15",
      text: "text-[#17181C]",
      fill: "bg-[#17181C]",
      track: "bg-[#17181C]/8",
      dot: "bg-[#17181C]",
    },
    gold: {
      badge: "bg-[#B8792F]/12 text-[#B8792F] border-[#B8792F]/25",
      text: "text-[#B8792F]",
      fill: "bg-[#B8792F]",
      track: "bg-[#B8792F]/12",
      dot: "bg-[#B8792F]",
    },
    teal: {
      badge: "bg-teal-500/12 text-teal-700 border-teal-500/20",
      text: "text-teal-700",
      fill: "bg-teal-600",
      track: "bg-teal-500/10",
      dot: "bg-teal-600",
    },
  };

  const renderCategoryCard = (cat: typeof categories[number]) => {
    const theme = themeMap[cat.accent] || themeMap.sage;
    return (
      <div
        key={cat.name}
        className="bg-white rounded-2xl p-5 border border-[#17181C]/8 shadow-xs flex flex-col justify-between space-y-4"
      >
        {/* Category Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#17181C]/6">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${theme.dot}`} />
            <div>
              <h5 className="text-sm font-bold text-[#17181C] leading-none">
                {cat.name}
              </h5>
              <span className="text-[10px] font-mono text-[#8B8C93] mt-1 block">
                {cat.weight}
              </span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-xl font-bold text-[#17181C]">
              {cat.score.toFixed(1)}
            </span>
            <span className="text-[10px] font-mono text-[#8B8C93] block">/ 100</span>
          </div>
        </div>

        {/* Sub-Metrics List */}
        <div className="space-y-3">
          {cat.metrics.map((m) => {
            const barPct = Math.max(0, Math.min(100, m.rawScore));
            return (
              <div key={m.label} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#6B6D76] font-medium text-[11px]">
                    {m.label}
                  </span>
                  <span
                    className={`font-mono text-[10px] font-bold px-1.5 py-0.2 rounded-md ${
                      barPct >= 70
                        ? "text-emerald-700 bg-emerald-50"
                        : barPct >= 40
                        ? "text-amber-700 bg-amber-50"
                        : "text-slate-400 bg-slate-100"
                    }`}
                  >
                    {m.rawScore.toFixed(0)}
                  </span>
                </div>
                <div className={`h-1.5 rounded-full ${theme.track} overflow-hidden`}>
                  <div
                    className={`h-full rounded-full ${
                      barPct >= 70
                        ? theme.fill
                        : barPct >= 40
                        ? "bg-[#B8792F]"
                        : "bg-slate-300"
                    } transition-all duration-500`}
                    style={{ width: `${barPct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-[#FFFFFF] rounded-3xl p-6 border border-[#17181C]/8 shadow-sm space-y-5">
      {/* Header with toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between group cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#7A2D3B]" />
          <h4 className="text-base font-bold text-[#17181C] group-hover:text-[#7A2D3B] transition-colors">
            Weighted Score Breakdown
          </h4>
        </div>

        <div className="flex items-center gap-3">
          {!isOpen && (
            <div className="flex items-center gap-2">
              {categories.map((cat) => {
                const t = themeMap[cat.accent];
                return (
                  <span
                    key={cat.name}
                    className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded-full border ${t.badge}`}
                  >
                    {cat.name.split(" ")[0]}: {cat.score.toFixed(0)}
                  </span>
                );
              })}
            </div>
          )}
          <span className="text-xs font-mono text-[#7A2D3B] font-bold">
            {isOpen ? "Hide ▲" : "View Details ▼"}
          </span>
        </div>
      </button>

      {/* Expanded Grid */}
      {isOpen && (
        <div className="space-y-4 pt-1 animate-fade-in">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {categories.map((cat) => renderCategoryCard(cat))}
          </div>

          {/* Formula Footer */}
          <div className="text-center pt-3 border-t border-[#1C1917]/6">
            <p className="text-[11px] font-mono text-[#a8a29e]">
              Weighted Formula: 35% Verbal Fluency + 30% Language Quality + 20% Vocal Delivery + 15% Presence
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Speech Composition Diagram ───────────────────────────────────────────────
// Donut showing active-speech vs silence split from real acoustic data.

export function SpeechCompositionDiagram({
  acoustic_stats,
  linguistic_stats,
  insights,
}: {
  acoustic_stats?: AcousticStats | null;
  linguistic_stats?: LinguisticStats | null;
  insights?: DerivedInsights | null;
}) {
  const silencePct = Math.min(
    100,
    Math.max(5, Math.round(insights?.silence_ratio_pct ?? 24)),
  );
  const activePct = 100 - silencePct;

  const c = 439.8; // 2 * PI * 70
  const activeDash = (activePct / 100) * c;
  const silenceDash = (silencePct / 100) * c;

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
      <div className="flex flex-col lg:flex-row items-center gap-8">
        {/* LEFT: Donut Chart with Callout Pointers */}
        <div className="relative w-64 h-64 shrink-0 flex items-center justify-center">
          <svg
            className="w-full h-full transform -rotate-90"
            viewBox="0 0 200 200"
          >
            {/* Donut Track */}
            <circle
              cx="100"
              cy="100"
              r="70"
              stroke="#f1f5f9"
              strokeWidth="18"
              fill="none"
            />

            {/* Active Speech Slice (Teal) */}
            <circle
              cx="100"
              cy="100"
              r="70"
              stroke="#0d9488"
              strokeWidth="18"
              fill="none"
              strokeDasharray={`${activeDash} ${c}`}
              strokeDashoffset="0"
              strokeLinecap="round"
            />

            {/* Silence / Pauses Slice (Blue) */}
            <circle
              cx="100"
              cy="100"
              r="70"
              stroke="#3b82f6"
              strokeWidth="18"
              fill="none"
              strokeDasharray={`${silenceDash} ${c}`}
              strokeDashoffset={`-${activeDash}`}
              strokeLinecap="round"
            />
          </svg>

          {/* Donut Center Display */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-3xl font-black text-slate-900 leading-none">
              {activePct}%
            </span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">
              Active Speech
            </span>
          </div>
        </div>

        {/* RIGHT: Metric Callout Items */}
        <div className="flex-1 w-full divide-y divide-slate-100">
          {/* Vocal Variety */}
          <div className="py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 shrink-0">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                  />
                </svg>
              </div>
              <div>
                <div className="text-sm font-bold text-slate-900">
                  Vocal Variety
                </div>
                <div className="text-xs text-slate-500 font-medium">
                  {(acoustic_stats?.pitch_variation ?? 0).toFixed(1)}Hz dev
                </div>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-purple-50 text-purple-600">
              {insights?.vocal_variety || "Dynamic"}
            </span>
          </div>

          {/* Pauses & Silence */}
          <div className="py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div>
                <div className="text-sm font-bold text-slate-900">
                  Pauses & Silence
                </div>
                <div className="text-xs text-slate-500 font-medium">
                  {(acoustic_stats?.pause_count || 0) === 0 && silencePct >= 40
                    ? `Dead air / silence (${silencePct}% silence)`
                    : `${acoustic_stats?.pause_count || 0} pauses (${silencePct}% silence)`}
                </div>
              </div>
            </div>
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
              silencePct >= 45 || (acoustic_stats?.pause_count || 0) > 10
                ? "bg-amber-50 text-amber-600"
                : "bg-blue-50 text-blue-600"
            }`}>
              {silencePct >= 45 ? "High Silence" : (acoustic_stats?.pause_count || 0) > 10 ? "High" : "Good"}
            </span>
          </div>

          {/* Movement (Fidgeting) */}
          <div className="py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center text-orange-600 shrink-0">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
              <div>
                <div className="text-sm font-bold text-slate-900">
                  Movement (Fidgeting)
                </div>
                <div className="text-xs text-slate-500 font-medium">
                  {insights?.fidget_index || "Low"}
                </div>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-orange-50 text-orange-600">
              {insights?.fidget_index === "High" ? "Needs Work" : "Good"}
            </span>
          </div>

          {/* Warmth & Tone */}
          <div className="py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-pink-50 flex items-center justify-center text-pink-600 shrink-0">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div>
                <div className="text-sm font-bold text-slate-900">
                  Warmth & Tone
                </div>
                <div className="text-xs text-slate-500 font-medium">
                  {insights?.warmth_index || "Neutral"}
                </div>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-pink-50 text-pink-600">
              Analyzed
            </span>
          </div>

          {/* Filler Word % */}
          <div className="py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
              </div>
              <div>
                <div className="text-sm font-bold text-slate-900">
                  Filler Words
                </div>
                <div className="text-xs text-slate-500 font-medium">
                  {((linguistic_stats?.filler_word_ratio ?? 0) * 100).toFixed(1)}% of speech
                </div>
              </div>
            </div>
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
              (linguistic_stats?.filler_word_ratio ?? 0) * 100 < 3
                ? "bg-emerald-50 text-emerald-600"
                : (linguistic_stats?.filler_word_ratio ?? 0) * 100 > 8
                  ? "bg-rose-50 text-rose-600"
                  : "bg-amber-50 text-amber-600"
            }`}>
              {(linguistic_stats?.filler_word_ratio ?? 0) * 100 < 3
                ? "Clean"
                : (linguistic_stats?.filler_word_ratio ?? 0) * 100 > 8
                ? "Distracting"
                : "Average"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Highlighted Transcript ───────────────────────────────────────────────────

export function HighlightedTranscript({
  text,
  fillerWords,
}: {
  text: string;
  fillerWords?: string[];
}) {
  const [copied, setCopied] = useState(false);

  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;

  const handleCopy = () => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Build target set of filler words dynamically from backend report
  const targetWords = new Set<string>();
  if (fillerWords && fillerWords.length > 0) {
    for (const w of fillerWords) {
      if (w.trim()) targetWords.add(w.toLowerCase().trim());
    }
  }
  // Always include unambiguous core fillers
  targetWords.add("uh");
  targetWords.add("um");
  targetWords.add("er");
  targetWords.add("ah");

  const sortedWords = Array.from(targetWords).sort(
    (a, b) => b.length - a.length,
  );
  const regexPattern =
    sortedWords.length > 0
      ? new RegExp(
          `\\b(${sortedWords.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`,
          "gi",
        )
      : null;

  const renderTextWithHighlights = (str: string) => {
    if (!regexPattern) return str;
    const parts = str.split(regexPattern);
    return parts.map((part, idx) => {
      if (targetWords.has(part.toLowerCase().trim())) {
        return (
          <mark
            key={idx}
            className="bg-amber-100/90 text-amber-900 font-bold px-1.5 py-0.5 rounded-md border border-amber-200/60 inline-block my-0.5 mx-0.5"
            title="Filler Word"
          >
            {part}
          </mark>
        );
      }
      return <span key={idx}>{part}</span>;
    });
  };

  // Group sentences into natural flowing paragraphs so short intros like "Hi." stay together
  const rawSentences = text
    .split(/(?<=[.!?])\s+/)
    .filter((s) => s.trim().length > 0);
  const paragraphs: string[] = [];
  let currentPara = "";

  for (const sentence of rawSentences) {
    if ((currentPara + " " + sentence).length > 220 && currentPara.length > 0) {
      paragraphs.push(currentPara.trim());
      currentPara = sentence;
    } else {
      currentPara = currentPara ? `${currentPara} ${sentence}` : sentence;
    }
  }
  if (currentPara.trim()) {
    paragraphs.push(currentPara.trim());
  }

  const displayParagraphs = paragraphs.length > 0 ? paragraphs : [text];

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80">
      {/* Header Controls */}
      <div className="flex items-center justify-between gap-4 mb-3.5 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-teal-50 flex items-center justify-center text-teal-600">
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-xs font-mono font-bold text-slate-700 uppercase tracking-wider">
              Video Transcript
            </h3>
            <p className="text-[10px] text-slate-400 font-medium">
              Filler words highlighted in amber
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Word Count Badge */}
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600">
            {wordCount} words
          </span>

          {/* Copy Button */}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 transition-colors cursor-pointer"
          >
            {copied ? (
              <>
                <svg
                  className="w-3.5 h-3.5 text-emerald-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <span className="text-emerald-700">Copied!</span>
              </>
            ) : (
              <>
                <svg
                  className="w-3.5 h-3.5 text-slate-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Transcript Text Container */}
      <div className="bg-slate-50/70 border border-slate-200/60 rounded-xl p-4 max-h-72 overflow-y-auto space-y-3">
        {displayParagraphs.map((para, idx) => (
          <p
            key={idx}
            className="text-sm text-slate-800 leading-relaxed font-medium"
          >
            {renderTextWithHighlights(para)}
          </p>
        ))}
      </div>
    </div>
  );
}

// ─── Backend Coaching Report ──────────────────────────────────────────────────

export function BackendReport({
  status,
  report,
  error,
  onSeek,
  onRetry,
}: {
  status: BackendStatus;
  report: AnalysisResponse | null;
  error: string;
  onSeek?: (timeMs: number) => void;
  onRetry?: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"deterministic" | "coaching" | "corrections">(
    "deterministic",
  );
  const [llmReport, setLlmReport] = useState<any | null>(null);
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmError, setLlmError] = useState("");
  const [showRawRanges, setShowRawRanges] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  // Poll for background LLM report if session_id is available
  useEffect(() => {
    // If backend already included coaching_report
    if (report?.coaching_report) {
      setLlmReport(report.coaching_report);
      return;
    }

    if (!report?.calibration_session_id) return;

    setLlmError("");
    setLlmReport(null);

    let isSubscribed = true;
    let pollTimer: ReturnType<typeof setTimeout>;
    let failureCount = 0;
    const MAX_FAILURES = 12;
    const POLL_DEADLINE_MS = 180_000; // stop spinning after 3 minutes total
    const startedAt = Date.now();

    const poll = async () => {
      setLlmLoading(true);

      // Overall deadline: a 202 "still processing" resets the failure counter,
      // so without this the spinner could run forever if the backend job died.
      if (Date.now() - startedAt > POLL_DEADLINE_MS) {
        setLlmError(
          "The coaching report is taking longer than expected and may have failed on the server."
        );
        setLlmLoading(false);
        return;
      }

      try {
        const { fetchCoachingReport } = await import("@/lib/api");
        const res = await fetchCoachingReport(report.calibration_session_id!);
        if (!isSubscribed) return;
        if (res) {
          setLlmReport(res);
          setLlmLoading(false);
        } else {
          // Still processing — reset failure count and try again
          failureCount = 0;
          pollTimer = setTimeout(poll, 5000);
        }
      } catch (err) {
        if (!isSubscribed) return;
        failureCount++;
        console.warn(`LLM Poll Error (attempt ${failureCount}/${MAX_FAILURES}):`, err);

        if (failureCount < MAX_FAILURES) {
          // Silently retry with exponential backoff: 5s, 10s, 20s, 40s
          const backoff = Math.min(5000 * Math.pow(2, failureCount - 1), 40000);
          pollTimer = setTimeout(poll, backoff);
        } else {
          // Exhausted retries — show error
          setLlmError(
            err instanceof Error ? err.message : "Failed to load LLM feedback",
          );
          setLlmLoading(false);
        }
      }
    };

    poll();

    return () => {
      isSubscribed = false;
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, [report, retryKey]);

  if (status === "idle") return null;

  if (status === "sending") {
    return (
      <div className="mt-6 bg-white rounded-2xl p-12 border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center animate-fade-in">
        <div className="relative w-16 h-16 mb-6">
          <div className="absolute inset-0 rounded-full border-[3px] border-slate-100"></div>
          <div className="absolute inset-0 rounded-full border-[3px] border-teal-500 border-t-transparent animate-spin"></div>
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-2">Analyzing your session</h3>
        <p className="text-sm text-slate-500 max-w-sm">
          Processing audio acoustics, vocal variety, and phrasing structure...
        </p>
      </div>
    );
  }

  if (status === "error" || !report) {
    return (
      <div className="mt-6 bg-white rounded-xl border border-rose-300 p-5 shadow-sm flex flex-col items-center justify-center text-center">
        <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center text-rose-500 mb-4 shadow-sm border border-rose-200/60">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <p className="text-sm font-bold text-slate-900 mb-1">
          Backend Connection Error
        </p>
        <p className="text-xs text-slate-600 mb-4 max-w-sm">{error || "Failed to load report data."}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-bold shadow-sm transition-all"
          >
            Retry Analysis
          </button>
        )}
      </div>
    );
  }

  const { overall_score, acoustic_stats, linguistic_stats, insights } = report;

  let eyePct = insights?.audience_connection_pct ?? 0;

  const eyeLabel = getEyeContactLabel(eyePct);
  const eyeColor = getStatusColor(eyeLabel);

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-6">
      <div className="text-center pb-2 border-b border-slate-100">
        <h2 className="text-xl font-bold text-slate-900 mb-6">
          Rehearsal Insights
        </h2>

        {/* Overall Score Circle */}
        <div className="relative w-32 h-32 mx-auto mb-3">
          <svg
            className="w-full h-full transform -rotate-90"
            viewBox="0 0 100 100"
          >
            {/* Background track */}
            <circle
              cx="50"
              cy="50"
              r="40"
              stroke="#ccfbf1"
              strokeWidth="8"
              fill="none"
            />
            {/* Progress track */}
            <circle
              cx="50"
              cy="50"
              r="40"
              stroke="#14b8a6"
              strokeWidth="8"
              fill="none"
              strokeDasharray="251.2"
              strokeDashoffset={251.2 - 251.2 * (overall_score / 100)}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-4xl font-bold text-white bg-teal-500 rounded-full w-24 h-24 flex items-center justify-center">
              {Math.round(overall_score)}
            </span>
          </div>
        </div>
        <h3 className="text-lg font-bold text-slate-800">Overall Score</h3>
      </div>

      {/* Score Breakdown */}
      <ScoreBreakdown report={report} />

      {/* Partial Pipeline Warning */}
      {report?.pipeline_status?.is_partial && (
        <div className="mx-4 sm:mx-6 my-4 p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 flex items-start gap-3 shadow-sm">
          <div className="mt-0.5 text-xl">⚠️</div>
          <div>
            <h4 className="font-bold">Partial Analysis Completed</h4>
            <p className="text-sm mt-1 text-rose-700">
              The backend encountered an error and could not complete all analysis steps. 
              {report.pipeline_status.warnings.includes("transcription_failed") && (
                <span className="font-semibold block mt-1">
                  Audio transcription failed (0 words). Please check your GROQ API Keys on the server, or ensure your microphone is not muted.
                </span>
              )}
              {report.pipeline_status.warnings.includes("event_detection_failed") && " Visual event detection failed."}
            </p>
          </div>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex items-center border-b border-slate-200">
        <button
          onClick={() => setActiveTab("deterministic")}
          className={`px-3 py-3 text-xs sm:text-sm font-bold transition-colors border-b-2 flex-1 text-center ${
            activeTab === "deterministic"
              ? "border-teal-500 text-teal-700 bg-teal-50/50"
              : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 hover:bg-slate-50"
          }`}
        >
          Speech Stats
        </button>
        <button
          onClick={() => setActiveTab("coaching")}
          className={`px-3 py-3 text-xs sm:text-sm font-bold transition-colors border-b-2 flex-1 text-center ${
            activeTab === "coaching"
              ? "border-amber-500 text-amber-700 bg-amber-50/50"
              : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 hover:bg-slate-50"
          }`}
        >
          AI Coach
        </button>
        <button
          onClick={() => setActiveTab("corrections")}
          className={`px-3 py-3 text-xs sm:text-sm font-bold transition-colors border-b-2 flex-1 text-center flex items-center justify-center gap-2 ${
            activeTab === "corrections"
              ? "border-indigo-500 text-indigo-700 bg-indigo-50/50"
              : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 hover:bg-slate-50"
          }`}
        >
          <span>Corrections</span>
          {(llmReport?.corrections?.length ?? 0) > 0 && (
            <span className="bg-indigo-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full shadow-xs">
              {llmReport.corrections.length}
            </span>
          )}
        </button>
      </div>

      <div className="pt-2">
        {/* Left Column: Bento Metric Cards */}
        {activeTab === "deterministic" && (
          <div className="space-y-6">
            <div>
              <h3 className="text-[11px] font-mono font-bold text-slate-500 uppercase tracking-wider mb-3 px-1">
                Acoustic & Linguistic Metrics
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* TOP ROW: Most Important (3 columns) */}
                <div className="md:col-span-1">
                  <MetricCard
                    icon={
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    }
                    color="teal"
                    title="Pacing"
                    value={`${acoustic_stats?.wpm.toFixed(0) || 0} WPM`}
                    status={insights?.pacing_status || "Optimal"}
                    layout="vertical"
                  />
                </div>

                <div className="md:col-span-1">
                  <MetricCard
                    icon={
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
                      />
                    }
                    color="teal"
                    title="Filler Words"
                    value={formatWordCounts(
                      linguistic_stats?.filler_words_found,
                    )}
                    status={insights?.filler_severity || "Good"}
                    layout="vertical"
                  />
                </div>

                <div className="md:col-span-1">
                  <MetricCard
                    icon={
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    }
                    color="rose"
                    title="Weak Words"
                    value={formatWordCounts(linguistic_stats?.weak_words_found)}
                    status={
                      (linguistic_stats?.weak_words_count || 0) > 5
                        ? "Needs Work"
                        : "Good"
                    }
                    layout="vertical"
                  />
                </div>

                <div className="md:col-span-3 mt-1">
                  <SpeechCompositionDiagram
                    acoustic_stats={acoustic_stats}
                    linguistic_stats={linguistic_stats}
                    insights={insights}
                  />
                </div>
              </div>
        </div>
      </div>
      )}

      {/* THE COACH — narrative voice. Same colors this section already had
          (teal / amber / emerald / rose) — only the waveform mark on
          Executive Coach Review is new, in the same teal that already
          anchors this block. Corrections split into its own tab below. */}
      {activeTab === "coaching" && (
      <div>
        <p className="text-[11px] font-mono font-bold text-teal-600 uppercase tracking-wider mb-3 px-1">
          The Coach — Narrative
        </p>
        <div className="space-y-4">
          {(llmLoading || !llmReport) && !llmError && (
            <div className="bg-white rounded-2xl p-12 border border-slate-200/80 shadow-sm flex flex-col items-center justify-center text-center">
              <div className="relative w-16 h-16 mb-6">
                <div className="absolute inset-0 rounded-full border-[3px] border-slate-100"></div>
                <div className="absolute inset-0 rounded-full border-[3px] border-amber-400 border-t-transparent animate-spin"></div>
              </div>
              <h4 className="text-[17px] font-bold text-slate-900 mb-2">
                Generating your AI Coaching Report...
              </h4>
              <p className="text-[14px] text-slate-500 font-medium max-w-sm">
                Analyzing your delivery, phrasing structure, tone, and
                grammar...
              </p>
            </div>
          )}

          {llmError && (
            <div className="bg-rose-50 rounded-2xl p-10 border border-rose-200/80 shadow-sm flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center text-rose-500 mb-4 shadow-sm border border-rose-200/60">
                <svg
                  className="w-6 h-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <h4 className="text-[16px] font-bold text-slate-900 mb-2">
                Failed to generate coaching insights
              </h4>
              <p className="text-sm text-slate-500 font-medium mb-5 max-w-sm mx-auto">
                {llmError}
              </p>
              <button
                onClick={() => setRetryKey((k) => k + 1)}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-bold shadow-sm transition-all"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
                Retry
              </button>
            </div>
          )}

          {/* 3. Success State (Loaded) */}
          {!llmLoading && llmReport && !llmError && (
            <div className="space-y-6 animate-fade-in">
              {/* Executive Synthesis */}
              {(llmReport.coach_review || llmReport.executive_summary) && (
                <div className="bg-gradient-to-r from-teal-50/50 via-white to-white rounded-2xl p-5 border border-slate-200 shadow-sm border-l-4 border-l-teal-500">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-2 h-2 rounded-full bg-teal-500" />
                    <h5 className="text-[11px] font-bold text-teal-700 uppercase tracking-wider">
                      Executive Coach Review
                    </h5>
                  </div>
                  <p className="text-[14.5px] text-slate-800 font-medium leading-relaxed whitespace-pre-line">
                    {llmReport.coach_review || llmReport.executive_summary}
                  </p>
                </div>
              )}

              {/* Main Bottleneck */}
              {llmReport.main_bottleneck && (
                <div className="bg-rose-50/50 rounded-2xl p-5 border border-rose-100 shadow-sm space-y-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    <h5 className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">
                      Main Bottleneck
                    </h5>
                  </div>
                  <h4 className="text-[15px] font-bold text-slate-900">{llmReport.main_bottleneck.title}</h4>
                  <p className="text-[13.5px] text-slate-700 font-medium">
                    <span className="font-semibold text-slate-900">Evidence:</span> {llmReport.main_bottleneck.evidence}
                  </p>
                  <p className="text-[13.5px] text-slate-700 font-medium">
                    <span className="font-semibold text-slate-900">Impact:</span> {llmReport.main_bottleneck.impact}
                  </p>
                </div>
              )}



              {/* Proof Moment */}
              {llmReport.proof_moment && (
                <div className="bg-amber-50/50 rounded-2xl p-5 border border-amber-100 shadow-sm space-y-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    <h5 className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">
                      Proof Moment
                    </h5>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    <div className="bg-white rounded-xl p-4 border border-amber-200/50">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Original Delivery</span>
                      <p className="text-slate-700 italic text-[14px] leading-relaxed font-medium">&quot;{llmReport.proof_moment.original_words}&quot;</p>
                    </div>
                    <div className="bg-white rounded-xl p-4 border border-amber-200/50">
                      <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-1 block">Stronger Version</span>
                      <p className="text-amber-950 font-semibold text-[14px] leading-relaxed">&quot;{llmReport.proof_moment.better_version}&quot;</p>
                    </div>
                  </div>
                  <div className="bg-white/80 rounded-xl p-3.5 border border-amber-100 mt-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Why this works better</span>
                    <div className="text-[13.5px] text-slate-700 leading-relaxed font-medium">{llmReport.proof_moment.why_this_works}</div>
                  </div>
                </div>
              )}




            </div>
          )}
        </div>
      </div>
      )}

      {/* CORRECTIONS — its own tab now, reachable in one click, no
          collapse/expand gate. You already chose to look at this by
          clicking the tab, so everything shows immediately. */}
      {activeTab === "corrections" && (
      <div>
        <p className="text-[11px] font-mono font-bold text-indigo-600 uppercase tracking-wider mb-3 px-1">
          Corrections
        </p>
        <div className="space-y-4">
          {(llmLoading || !llmReport) && !llmError && (
            <div className="bg-white rounded-2xl p-10 border border-slate-200/80 shadow-sm flex flex-col items-center justify-center text-center">
              <div className="relative w-12 h-12 mb-4">
                <div className="absolute inset-0 rounded-full border-[3px] border-slate-100"></div>
                <div className="absolute inset-0 rounded-full border-[3px] border-indigo-400 border-t-transparent animate-spin"></div>
              </div>
              <p className="text-sm font-bold text-slate-900 mb-1">
                Corrections are still generating
              </p>
              <p className="text-[13px] text-slate-500 max-w-xs">
                These come from the same AI coaching pass — check The Coach tab for progress.
              </p>
            </div>
          )}

          {llmError && (
            <div className="bg-rose-50 rounded-2xl p-10 border border-rose-200/80 shadow-sm text-center">
              <p className="text-sm font-bold text-slate-900 mb-1">Couldn&apos;t load corrections</p>
              <p className="text-[13px] text-slate-600 mb-4">{llmError}</p>
              <button
                onClick={() => setRetryKey((k) => k + 1)}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-bold shadow-sm transition-all"
              >
                Retry
              </button>
            </div>
          )}

          {!llmLoading && !llmError && llmReport && (!llmReport.corrections || llmReport.corrections.length === 0) && (
            <div className="bg-white rounded-2xl p-10 text-center border border-slate-100 shadow-sm">
              <span className="text-3xl mb-3 block">🎉</span>
              <h5 className="text-base font-bold text-slate-900 mb-1">Flawless Phrasing!</h5>
              <p className="text-sm text-slate-500 font-medium">
                No phrasing or filler word corrections were detected for this session.
              </p>
            </div>
          )}

          {!llmLoading && !llmError && llmReport?.corrections?.length > 0 && (
            <CorrectionsPanel corrections={llmReport.corrections} />
          )}
        </div>
      </div>
      )}
      </div>
    </div>
  );
}
export function CorrectionsPanel({ corrections }: { corrections: any[] }) {
  const grouped = corrections.reduce((acc: any, corr: any) => {
    const cat = corr.category || "Phrasing & Grammar";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(corr);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([category, corrs]: [string, any], groupIdx: number) => (
        <div key={groupIdx} className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-5">
          <div className="text-[11px] font-bold text-slate-600 uppercase tracking-widest border-b border-slate-100 pb-3 flex items-center justify-between">
            <span>{category}</span>
            <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100">
              {corrs.length} {corrs.length === 1 ? "correction" : "corrections"}
            </span>
          </div>
          <div className="space-y-5">
            {corrs.map((corr: any, idx: number) => (
              <div key={idx} className="space-y-3 pb-5 last:pb-0 border-b last:border-b-0 border-slate-100">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div className="bg-rose-50/60 rounded-xl p-4 border border-rose-100/80 border-l-4 border-l-rose-400">
                    <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider mb-1.5 block">Before</span>
                    <p className="text-slate-700 italic text-[14px] leading-relaxed font-medium line-through decoration-rose-400/70 decoration-2">&quot;{corr.before}&quot;</p>
                  </div>
                  <div className="bg-emerald-50/60 rounded-xl p-4 border border-emerald-100/80 border-l-4 border-l-emerald-500">
                    <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider mb-1.5 block">Polished Delivery</span>
                    <p className="text-emerald-950 font-semibold text-[14px] leading-relaxed">&quot;{corr.after}&quot;</p>
                  </div>
                </div>
                {corr.why && (
                  <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200/70 mt-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Why this works better</span>
                    <div className="text-[13.5px] text-slate-700 leading-relaxed font-medium">{corr.why}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Score Panel (MediaPipe Telemetry & Emotion Signals) ──────────────────────

export type StatusLevel = "Excellent" | "Good" | "Needs Work";
export type StatusColor = "teal" | "amber" | "rose";

export function getStatusColor(status: StatusLevel): StatusColor {
  if (status === "Excellent") return "teal";
  if (status === "Good") return "amber";
  return "rose";
}

export function getEyeContactLabel(pct: number): StatusLevel {
  if (pct >= 70) return "Excellent";
  if (pct >= 45) return "Good";
  return "Needs Work";
}

export function getGazeZoneLabel(pct: number): StatusLevel {
  if (pct >= 60) return "Excellent";
  if (pct >= 40) return "Good";
  return "Needs Work";
}

export function getAnxietyLabel(pct: number): StatusLevel {
  if (pct < 15) return "Excellent";
  if (pct <= 40) return "Good";
  return "Needs Work";
}

export function getStressLabel(pct: number): StatusLevel {
  if (pct < 15) return "Excellent";
  if (pct <= 40) return "Good";
  return "Needs Work";
}

export function getHeadPoseLabel(yawDeg: number): StatusLevel {
  const absYaw = Math.abs(yawDeg);
  if (absYaw <= 10) return "Excellent";
  if (absYaw <= 20) return "Good";
  return "Needs Work";
}

export function getHeadPoseText(yawDeg: number): string {
  if (yawDeg > 10) return "Looking Left";
  if (yawDeg < -10) return "Looking Right";
  return "Centered";
}

export function ScoreBar({
  label,
  value,
  unit = "%",
  invert = false,
}: {
  label: string;
  value: number;
  unit?: string;
  invert?: boolean;
}) {
  const pct =
    unit === "°"
      ? Math.min(100, (Math.abs(value) / 30) * 100)
      : Math.round(value * 100);
  const display = unit === "°" ? `${value.toFixed(1)}°` : `${pct}%`;
  const color = invert
    ? pct > 60
      ? "bg-rose-500"
      : pct > 30
        ? "bg-amber-500"
        : "bg-emerald-600"
    : pct > 65
      ? "bg-emerald-600"
      : pct > 35
        ? "bg-amber-500"
        : "bg-rose-500";

  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs text-slate-600 font-medium">{label}</span>
        <span className="text-xs font-mono font-bold text-slate-900">
          {display}
        </span>
      </div>
      <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden border border-slate-300">
        <div
          className={`h-full rounded-full transition-all duration-300 ${color}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}

// ─── Scored Telemetry Panel ──────────────────────────────────────────────────

export function ScoredTelemetryPanel({
  frameAnalysis,
}: {
  frameAnalysis: FrameAnalysisEntry[];
}) {
  const detected = frameAnalysis.filter((f) => f.faceDetected);
  if (detected.length === 0) return null;
  const avg = (key: keyof FrameAnalysisEntry) =>
    detected.reduce((s, f) => s + ((f[key] as number) ?? 0), 0) /
    detected.length;

  // browRaise = browInnerUp (AU1) — an observable signal, not an anxiety
  // diagnosis. Relabeled honestly across the UI.
  const browRaise = avg("browRaiseScore") * 100;
  const stress = avg("stressScore") * 100;
  const confusion = avg("confusionScore") * 100;
  const headPose = avg("headPoseScore") * 100;

  const total = detected.length;
  const gazeCenter = Math.round(
    (detected.filter((f) => f.gazeZone === "center").length / total) * 100,
  );

  const eyeLabel = gazeCenter >= 60 ? "Excellent" : gazeCenter >= 40 ? "Good" : "Needs Work";
  const eyeColor = getStatusColor(eyeLabel);

  const browRaiseLabel = getAnxietyLabel(browRaise);
  const browRaiseColor = getStatusColor(browRaiseLabel);

  const stressLabel = getStressLabel(stress);
  const stressColor = getStatusColor(stressLabel);

  const postureLabel = headPose >= 75 ? "Excellent" : headPose >= 55 ? "Good" : "Needs Work";
  const postureColor = getStatusColor(postureLabel);

  // Warmth Engagement Ratio: % of frames showing pleasant/warm expression (AU12 smile or AU6 cheek squint).
  // In conversational speech, showing warmth 10-20% of the time represents strong engagement.
  const warmFrames = detected.filter(
    (f) => (f.smileScore ?? 0) >= 0.10 || (f.cheekSquintScore ?? 0) >= 0.05
  ).length;
  const warmthPct = Math.round((warmFrames / total) * 100);
  const smileLabel = warmthPct >= 12 ? "Excellent" : warmthPct >= 5 ? "Good" : "Needs Work";
  const smileColor = getStatusColor(smileLabel);

  const confusionLabel = confusion <= 5 ? "Excellent" : confusion <= 15 ? "Good" : "Needs Work";
  const confusionColor = getStatusColor(confusionLabel);

  return (
    <div className="mt-6 bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[11px] font-mono font-bold text-slate-700 uppercase tracking-wider">
          SCORED TELEMETRY
        </span>
      </div>

      <div className="space-y-3">
        {/* Eye Contact (using Gaze Center) */}
        <MetricCard
          icon={
            <>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
              />
            </>
          }
          color={eyeColor}
          title="Eye Contact (Center Gaze)"
          value={`${gazeCenter}%`}
          status={eyeLabel}
          progress={gazeCenter}
        />

        {/* Warmth / Positivity */}
        <MetricCard
          icon={
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
          }
          color={smileColor}
          title="Warmth & Positivity"
          value={`${warmthPct}%`}
          status={smileLabel}
          progress={warmthPct}
        />

        {/* Confusion/Thinking */}
        <MetricCard
          icon={
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z"
            />
          }
          color={confusionColor}
          title="Confusion / Thinking"
          value={`${Math.round(confusion)}%`}
          status={confusionLabel}
          progress={Math.round(confusion)}
        />

        {/* Anxiety */}
        <MetricCard
          icon={
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          }
          color={browRaiseColor}
          title="Brow Raise (AU1)"
          value={`${Math.round(browRaise)}%`}
          status={browRaiseLabel}
          progress={Math.round(browRaise)}
        />

        {/* Stress */}
        <MetricCard
          icon={
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
            />
          }
          color={stressColor}
          title="Stress Signal"
          value={`${Math.round(stress)}%`}
          status={stressLabel}
          progress={Math.round(stress)}
        />

        {/* Head Pose */}
        <MetricCard
          icon={
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          }
          color={postureColor}
          title="Head Pose / Posture"
          value={`${Math.round(headPose)}%`}
          status={postureLabel}
          progress={Math.round(headPose)}
        />
      </div>
    </div>
  );
}