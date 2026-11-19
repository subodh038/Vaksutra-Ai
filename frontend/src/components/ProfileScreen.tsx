"use client";

import { useEffect, useState } from "react";
import { fetchProfile, getCurrentUser } from "@/lib/auth";
import AccountMenu from "./AccountMenu";

interface ProfileScreenProps {
  onBack: () => void;
  onNavigate: (page: string) => void;
  loggedIn?: boolean;
  userEmail?: string;
  onLogout?: () => void;
}

interface CoachingProfile {
  session_count: number;
  avg_score: number | null;
  best_score: number | null;
  last_score: number | null;
  score_trend: "improving" | "declining" | "stable";
  top_filler_words: string[];
  recurring_weaknesses: string[];
  recurring_strengths: string[];
  coaching_summary: string | null;
  memory_active: boolean;
  last_session_at: string | null;
}

const WEAKNESS_LABELS: Record<string, string> = {
  filler_words:         "Filler Words",
  eye_contact:          "Eye Contact",
  speaking_too_fast:    "Speaking Too Fast",
  speaking_too_slow:    "Speaking Too Slow",
  monotone_delivery:    "Monotone Delivery",
  no_strategic_pauses:  "No Strategic Pauses",
  visible_anxiety:      "Visible Tension",   // slug kept for historical rows; brow/press-based signal
};

const STRENGTH_LABELS: Record<string, string> = {
  strong_eye_contact:  "Strong Eye Contact",
  good_pacing:         "Good Pacing",
  expressive_voice:    "Expressive Voice",
  confident_presence:  "Confident Presence",
};

const MEMORY_THRESHOLD = 3;

function TrendIcon({ trend }: { trend: string }) {
  if (trend === "improving") return <span className="text-emerald-500 text-lg">↑</span>;
  if (trend === "declining") return <span className="text-rose-500 text-lg">↓</span>;
  return <span className="text-amber-500 text-lg">→</span>;
}

function TrendBadge({ trend }: { trend: string }) {
  const cfg = {
    improving: { bg: "bg-emerald-50 border-emerald-200 text-emerald-700", label: "Improving" },
    declining:  { bg: "bg-rose-50 border-rose-200 text-rose-700",         label: "Declining" },
    stable:     { bg: "bg-amber-50 border-amber-200 text-amber-700",       label: "Stable" },
  }[trend] ?? { bg: "bg-amber-50 border-amber-200 text-amber-700", label: "Stable" };

  return (
    <span className={`text-[11px] font-semibold px-3 py-1 rounded-full border ${cfg.bg}`}>
      {cfg.label}
    </span>
  );
}

export default function ProfileScreen({ onBack, onNavigate, loggedIn, userEmail, onLogout }: ProfileScreenProps) {
  const [profile, setProfile] = useState<CoachingProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const user = getCurrentUser();

  useEffect(() => {
    fetchProfile()
      .then(setProfile)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const sessionsToMemory = profile
    ? Math.max(0, MEMORY_THRESHOLD - (profile.session_count || 0))
    : MEMORY_THRESHOLD;

  return (
    <div className="min-h-screen bg-[#FFFFFF] text-[#17181C] animate-fade-in">
      {/* Nav */}
      <div className="fixed top-4 left-0 right-0 z-50 flex justify-center px-4">
        <nav
          className="rounded-full px-6 py-2.5 flex items-center justify-between gap-6 w-full max-w-4xl border border-[#17181C]/[0.06] bg-white/80"
          style={{ backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", boxShadow: "0 8px 30px rgba(23,24,28,0.06)" }}
        >
          <button onClick={onBack} className="flex items-center gap-2 cursor-pointer shrink-0">
            <div className="w-7 h-7 rounded-full bg-[#17181C] flex items-center justify-center text-white font-black text-xs">V</div>
            <span className="font-semibold text-sm text-[#17181C] tracking-tight">
              VakSutra <span className="text-[#7A2D3B]">AI</span>
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-[#7A2D3B]/10 text-[#7A2D3B] border border-[#7A2D3B]/20 leading-none">
              Beta
            </span>
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigate("history")}
              className="px-3 py-1.5 text-xs font-medium text-[#6B6D76] hover:text-[#17181C] rounded-full hover:bg-[#17181C]/8 transition-all cursor-pointer"
            >
              Session History
            </button>
            <button
              onClick={onBack}
              className="text-xs text-[#6B6D76] hover:text-[#17181C] font-medium px-3.5 py-1.5 rounded-full border border-[#17181C]/10 hover:bg-[#17181C]/5 transition-all cursor-pointer"
            >
              ← Studio
            </button>
            {loggedIn && <AccountMenu userEmail={userEmail} onNavigate={onNavigate} onLogout={onLogout} />}
          </div>
        </nav>
      </div>

      <main className="max-w-2xl mx-auto px-4 pt-28 pb-16 space-y-5">
        {/* Header */}
        <div className="mb-2">
          <p className="text-[10px] font-mono uppercase text-[#7A2D3B] tracking-widest mb-1">COACHING PROFILE</p>
          <h1 className="text-3xl font-bold text-[#17181C]">
            {user?.name ? `${user.name}'s AI Coach` : "Your AI Coach"}
          </h1>
          {user && (
            <p className="text-sm text-[#6B6D76] mt-1">{user.email}</p>
          )}
        </div>

        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-6 h-6 border-2 border-[#7A2D3B] border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-[#8B8C93] font-mono">Loading your profile...</p>
          </div>
        )}

        {error && (
          <div className="text-center py-20">
            <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-2xl px-6 py-4">{error}</p>
          </div>
        )}

        {!loading && !error && profile && (
          <div className="space-y-4">
            {/* Score overview */}
            <div className="bg-white rounded-2xl border border-[#17181C]/[0.08] p-5 sm:p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-[10px] font-mono uppercase text-[#7A2D3B] tracking-widest">Performance Overview</p>
                  <p className="text-xs text-[#8B8C93] mt-0.5">Overall practice trajectory</p>
                </div>
                <TrendBadge trend={profile.score_trend} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3.5 bg-[#F6F6F7] rounded-xl border border-[#17181C]/[0.04]">
                  <p className="text-2xl sm:text-3xl font-black text-[#17181C]">
                    {profile.session_count}
                  </p>
                  <p className="text-[10px] font-mono uppercase text-[#8B8C93] mt-0.5">Sessions</p>
                </div>
                <div className="text-center p-3.5 bg-[#F6F6F7] rounded-xl border border-[#17181C]/[0.04]">
                  <p className="text-2xl sm:text-3xl font-black text-[#17181C]">
                    {profile.avg_score != null ? profile.avg_score.toFixed(0) : "—"}
                  </p>
                  <p className="text-[10px] font-mono uppercase text-[#8B8C93] mt-0.5">Avg Score</p>
                </div>
                <div className="text-center p-3.5 bg-[#F6F6F7] rounded-xl border border-[#17181C]/[0.04]">
                  <p className="text-2xl sm:text-3xl font-black text-[#059669]">
                    {profile.best_score != null ? profile.best_score.toFixed(0) : "—"}
                  </p>
                  <p className="text-[10px] font-mono uppercase text-[#8B8C93] mt-0.5">Best Score</p>
                </div>
              </div>

              {profile.last_score != null && (
                <div className="mt-4 pt-3.5 border-t border-[#17181C]/[0.06] flex items-center justify-between text-xs text-[#6B6D76]">
                  <div className="flex items-center gap-2">
                    <TrendIcon trend={profile.score_trend} />
                    <span>
                      Last session score: <strong className="text-[#17181C] font-mono">{profile.last_score}</strong>
                    </span>
                  </div>
                  {profile.last_session_at && (
                    <span className="text-[11px] text-[#8B8C93] font-mono">
                      {new Date(profile.last_session_at).toLocaleDateString("en-IN", {
                        day: "numeric", month: "short", year: "numeric"
                      })}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* The Soul — AI Coaching Memory Hero */}
            <div className={`rounded-2xl border p-5 sm:p-6 shadow-sm transition-all ${
              profile.memory_active
                ? "bg-gradient-to-br from-[#FAF5F0] via-white to-[#FDFBF7] border-[#B5602F]/30 shadow-[0_4px_16px_rgba(181,96,47,0.06)]"
                : "bg-white border-[#17181C]/[0.08]"
            }`}>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-[#B5602F]/10 flex items-center justify-center text-2xl shrink-0 border border-[#B5602F]/20">
                  {profile.memory_active ? "🧠" : "⏳"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                    <p className="text-[10px] font-mono uppercase tracking-widest text-[#8A4322] font-bold">
                      AI COACHING MEMORY
                    </p>
                    {profile.memory_active && (
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        Active Memory
                      </span>
                    )}
                  </div>
                  {profile.memory_active ? (
                    <>
                      <h3 className="text-base font-bold text-[#17181C] mb-1.5">
                        Persistent Coach Memory Active
                      </h3>
                      {profile.coaching_summary ? (
                        <div className="p-3.5 bg-white/80 rounded-xl border border-[#B5602F]/20 mt-2 text-xs leading-relaxed text-[#3A3B40]">
                          &ldquo;{profile.coaching_summary}&rdquo;
                        </div>
                      ) : (
                        <p className="text-xs text-[#6B6D76] leading-relaxed">
                          Your coach continuously monitors your delivery patterns across sessions to give cumulative feedback that builds on past rehearsals.
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <h3 className="text-sm font-bold text-[#17181C] mb-1">
                        Unlocks in {sessionsToMemory} more session{sessionsToMemory !== 1 ? "s" : ""}
                      </h3>
                      <p className="text-xs text-[#6B6D76] leading-relaxed">
                        After {MEMORY_THRESHOLD} sessions, your AI coach synthesizes your persistent speaking memory,
                        tailoring future reviews to your recurring strengths and blind spots.
                      </p>
                      <div className="mt-3.5 h-2 bg-[#17181C]/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#7A2D3B] rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, (profile.session_count / MEMORY_THRESHOLD) * 100)}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-[#8B8C93] mt-1.5 font-mono">
                        {profile.session_count}/{MEMORY_THRESHOLD} sessions completed
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Unified Speaking Patterns: Strengths & Growth Areas */}
            {(profile.recurring_strengths.length > 0 || profile.recurring_weaknesses.length > 0) && (
              <div className="bg-white rounded-2xl border border-[#17181C]/[0.08] p-5 sm:p-6 shadow-sm">
                <div className="mb-4">
                  <p className="text-[10px] font-mono uppercase text-[#7A2D3B] tracking-widest font-bold">
                    Speaking Patterns & Habits
                  </p>
                  <p className="text-xs text-[#8B8C93] mt-0.5">Identified from multi-session acoustic and visual telemetry</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Strengths */}
                  <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-100 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 mb-3 text-emerald-800 font-semibold text-xs">
                        <span>✓</span>
                        <span>Consistent Strengths</span>
                      </div>
                      {profile.recurring_strengths.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {profile.recurring_strengths.map((s) => (
                            <span
                              key={s}
                              className="text-xs px-3 py-1 bg-white text-emerald-800 border border-emerald-200 rounded-full font-medium shadow-2xs"
                            >
                              {STRENGTH_LABELS[s] || s.replace(/_/g, " ")}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-emerald-700/70 italic">Keep practicing to establish baseline strengths.</p>
                      )}
                    </div>
                  </div>

                  {/* Weaknesses / Focus Areas */}
                  <div className="p-4 rounded-xl bg-rose-50/40 border border-rose-100 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 mb-3 text-rose-800 font-semibold text-xs">
                        <span>🎯</span>
                        <span>Growth Focus Areas</span>
                      </div>
                      {profile.recurring_weaknesses.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {profile.recurring_weaknesses.map((w) => (
                            <span
                              key={w}
                              className="text-xs px-3 py-1 bg-white text-rose-800 border border-rose-200 rounded-full font-medium shadow-2xs"
                            >
                              {WEAKNESS_LABELS[w] || w.replace(/_/g, " ")}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-rose-700/70 italic">No recurring weaknesses detected.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Top filler words */}
            {profile.top_filler_words.length > 0 && (
              <div className="bg-white rounded-2xl border border-[#17181C]/[0.08] p-5 sm:p-6 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-[10px] font-mono uppercase text-[#7A2D3B] tracking-widest font-bold">Verbal Crutches</p>
                    <p className="text-xs text-[#8B8C93] mt-0.5">Most frequent filler words detected across speech</p>
                  </div>
                  <span className="text-xs font-mono text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                    {profile.top_filler_words.length} tracked
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 mb-3">
                  {profile.top_filler_words.map((word) => (
                    <span
                      key={word}
                      className="font-mono text-xs font-bold px-3.5 py-1.5 bg-amber-50/80 text-amber-900 border border-amber-200/80 rounded-xl"
                    >
                      &ldquo;{word}&rdquo;
                    </span>
                  ))}
                </div>
                <p className="text-[11px] text-[#6B6D76] bg-[#F6F6F7] p-3 rounded-xl border border-[#17181C]/[0.04]">
                  💡 <strong>Coach Tip:</strong> When you feel the urge to insert a filler sound, pause silently for 1 second. Silence conveys confidence and lets you organize your thoughts.
                </p>
              </div>
            )}

            {/* CTA Action Bar */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={() => onNavigate("history")}
                className="flex-1 py-3 text-xs font-semibold rounded-full border border-[#17181C]/15 text-[#17181C] hover:bg-[#17181C]/5 transition-all cursor-pointer text-center"
              >
                View Session History
              </button>
              <button
                onClick={onBack}
                className="flex-1 bg-[#17181C] hover:bg-[#2b2c31] transition-colors text-white py-3 text-xs font-semibold rounded-full shadow-md cursor-pointer text-center"
              >
                Practice Again →
              </button>
            </div>
          </div>
        )}

        {!loading && !error && !profile && (
          <div className="text-center py-20 space-y-3">
            <p className="text-4xl">🎤</p>
            <p className="text-xl font-bold text-[#17181C]">No sessions yet</p>
            <p className="text-sm text-[#6B6D76]">Complete your first practice session to start building your coaching profile.</p>
            <button
              onClick={onBack}
              className="mt-4 bg-[#17181C] hover:bg-[#2b2c31] transition-colors text-white px-6 py-2.5 rounded-full text-xs font-semibold shadow-md cursor-pointer"
            >
              Start Practicing →
            </button>
          </div>
        )}
      </main>
    </div>
  );
}