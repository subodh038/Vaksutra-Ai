"use client";

import AccountMenu from "./AccountMenu";

import { useEffect, useState } from "react";
import { fetchSessions, getCurrentUser } from "@/lib/auth";
import { resolveSessionVideoUrl, type AnalysisResponse } from "@/lib/api";
import ReviewScreen from "./ReviewScreen";

interface HistoryScreenProps {
  onBack: () => void;
  onNavigate: (page: string) => void;
  loggedIn?: boolean;
  userEmail?: string;
  onLogout?: () => void;
}

interface Session {
  id: string;
  session_id: string;
  mode: string;
  score: number;
  topic?: string;
  transcript?: string;
  video_url?: string;
  coaching_report?: {
    overall_assessment?: string;
    strengths?: string[];
    gap_analysis?: string[];
    improvement_plan?: string[];
    coach_final_note?: string;
  };
  key_metrics?: {
    wpm?: number;
    filler_word_ratio?: number;
    avg_eye_contact?: number;
    pause_count?: number;
    pitch_variation?: number;
  };
  created_at: string;
  full_analysis?: AnalysisResponse;
}

function ScoreBadge({ score }: { score: number }) {
  const bg =
    score >= 80
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : score >= 60
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : "bg-rose-50 text-rose-700 border-rose-200";
  const label =
    score >= 80 ? "Excellent" : score >= 60 ? "Good" : "Needs Work";
  return (
    <div className={`flex flex-col items-center justify-center w-13 h-13 sm:w-14 sm:h-14 rounded-2xl border ${bg} shrink-0 shadow-xs`}>
      <span className="text-lg sm:text-xl font-black leading-none">{Math.round(score)}</span>
      <span className="text-[8px] font-mono uppercase font-bold tracking-tight mt-1">{label}</span>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center bg-[#FFFFFF] rounded-xl p-2.5 border border-[#17181C]/6 min-w-[64px]">
      <span className="text-sm font-bold text-[#17181C]">{value}</span>
      <span className="text-[10px] text-[#8B8C93] font-mono uppercase mt-0.5">{label}</span>
    </div>
  );
}

/** Resolves a stored video reference (path or legacy URL) into a playable signed URL. */
function SessionVideoPlayer({ videoRef }: { videoRef: string }) {
  const [playableUrl, setPlayableUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    resolveSessionVideoUrl(videoRef)
      .then((url) => {
        if (cancelled) return;
        if (url) setPlayableUrl(url);
        else setFailed(true);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [videoRef]);

  return (
    <div className="bg-black/5 rounded-xl border border-[#17181C]/6 overflow-hidden mt-4">
      {failed ? (
        <p className="text-[11px] text-[#8B8C93] italic p-3 text-center">
          Video unavailable for this session.
        </p>
      ) : !playableUrl ? (
        <div className="flex items-center justify-center py-10">
          <div className="w-5 h-5 border-2 border-[#7A2D3B] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <video
          src={playableUrl}
          controls
          className="w-full max-h-64 object-cover"
          aria-label="Recorded session playback"
        />
      )}
    </div>
  );
}

function ScoreProgressionChart({ sessions }: { sessions: Session[] }) {
  if (!sessions.length) return null;
  // Sort chronological (oldest to newest) for progression
  const recentSessions = sessions.slice(0, 16).reverse();
  const max = 100;

  return (
    <div className="mt-5 pt-4 border-t border-[#17181C]/[0.07]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono uppercase font-bold text-[#7A2D3B] tracking-wider">Score Progression</span>
          <span className="text-[10px] text-[#8B8C93]">({recentSessions.length} latest)</span>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-[#8B8C93] font-mono">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#059669]"></span> 80+
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#B8792F]"></span> 60-79
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#C1373A]"></span> &lt;60
          </span>
        </div>
      </div>
      <div className="flex items-end gap-1.5 h-20 w-full bg-[#17181C]/[0.02] p-2.5 rounded-xl border border-[#17181C]/[0.04]">
        {recentSessions.map((s, i) => {
          const score = s.score;
          const color = score >= 80 ? "bg-[#059669]" : score >= 60 ? "bg-[#B8792F]" : "bg-[#C1373A]";
          const date = new Date(s.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
          return (
            <div key={i} className="flex-1 h-full flex flex-col justify-end items-center group relative cursor-pointer">
              <div
                className={`w-full rounded-t-md ${color} opacity-80 group-hover:opacity-100 transition-all duration-200 group-hover:scale-y-[1.05]`}
                style={{ height: `${Math.max(12, (score / max) * 100)}%` }}
              />
              {/* Tooltip */}
              <div className="absolute -top-10 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-20 flex flex-col items-center whitespace-nowrap">
                <div className="bg-[#17181C] text-white text-[10px] font-mono px-2 py-1 rounded-md shadow-md">
                  <span className="font-bold">{Math.round(score)}</span> · {date}
                </div>
                <div className="w-1.5 h-1.5 bg-[#17181C] rotate-45 -mt-0.5" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SessionCard({ 
  session, 
  expanded, 
  onToggleExpand, 
  onSelectSession 
}: { 
  session: Session;
  expanded: boolean;
  onToggleExpand: () => void;
  onSelectSession: (session: Session) => void;
}) {
  const date = new Date(session.created_at);
  const dateStr = date.toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });
  const timeStr = date.toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit",
  });
  const km = session.key_metrics;

  return (
    <div className="group bg-white rounded-2xl border border-[#17181C]/[0.08] hover:border-[#7A2D3B]/30 overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:shadow-md transition-all duration-200">
      {/* Summary row */}
      <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5 flex-1 min-w-0">
          <ScoreBadge score={session.score} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-[10px] font-mono uppercase font-bold text-[#7A2D3B] bg-[#7A2D3B]/10 px-2.5 py-0.5 rounded-full">
                {session.mode}
              </span>
              <span className="text-[11px] text-[#8B8C93] font-mono">
                {dateStr} · {timeStr}
              </span>
            </div>
            {session.topic ? (
              <p className="text-sm font-semibold text-[#17181C] leading-snug line-clamp-1 group-hover:text-[#7A2D3B] transition-colors">
                &ldquo;{session.topic.replace(/^["'“”‘’«»]+|["'“”‘’«»]+$/g, "").trim()}&rdquo;
              </p>
            ) : (
              <p className="text-xs text-[#8B8C93] italic">Impromptu Practice Session</p>
            )}

            {/* Quick Inline Telemetry Chips */}
            {km && (
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {km.wpm != null && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#4B4C52] bg-[#F6F6F7] px-2 py-0.5 rounded-md">
                    ⚡ {Math.round(km.wpm)} WPM
                  </span>
                )}
                {km.avg_eye_contact != null && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#4B4C52] bg-[#F6F6F7] px-2 py-0.5 rounded-md">
                    👁️ {Math.round(km.avg_eye_contact * 100)}% Eye
                  </span>
                )}
                {km.filler_word_ratio != null && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#4B4C52] bg-[#F6F6F7] px-2 py-0.5 rounded-md">
                    🗣️ {(km.filler_word_ratio * 100).toFixed(1)}% Fillers
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
          {session.full_analysis && (
            <button
              onClick={() => onSelectSession(session)}
              className="text-xs font-semibold text-white bg-[#17181C] hover:bg-[#7A2D3B] px-3.5 py-1.5 rounded-full transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
            >
              <span>View Report</span>
              <span>→</span>
            </button>
          )}
          <button
            onClick={onToggleExpand}
            className="p-1.5 text-xs text-[#6B6D76] hover:text-[#17181C] hover:bg-[#17181C]/5 rounded-full transition-colors cursor-pointer"
            title={expanded ? "Collapse details" : "Expand details"}
          >
            <span className="text-xs">{expanded ? "▲" : "▼"}</span>
          </button>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-[#17181C]/6 px-5 pb-5 pt-4 space-y-4 bg-[#FAFAFA]/60">
          {/* Metrics row */}
          {km && (
            <div className="flex gap-2 flex-wrap">
              {km.wpm != null && (
                <Metric label="WPM" value={`${Math.round(km.wpm)}`} />
              )}
              {km.filler_word_ratio != null && (
                <Metric label="Fillers" value={`${(km.filler_word_ratio * 100).toFixed(1)}%`} />
              )}
              {km.avg_eye_contact != null && (
                <Metric label="Eye Contact" value={`${Math.round(km.avg_eye_contact * 100)}%`} />
              )}
              {km.pause_count != null && (
                <Metric label="Pauses" value={`${km.pause_count}`} />
              )}
              {km.pitch_variation != null && (
                <Metric label="Pitch Var" value={`${km.pitch_variation.toFixed(1)} Hz`} />
              )}
            </div>
          )}

          {/* Video Player */}
          {session.video_url && (
            <SessionVideoPlayer videoRef={session.video_url} />
          )}

          {/* Coaching report */}
          {session.coaching_report ? (
            <div className="space-y-3">
              {session.coaching_report.overall_assessment && (
                <div className="bg-[#FFFFFF] rounded-xl p-4 border border-[#17181C]/6">
                  <p className="text-[10px] font-mono uppercase text-[#7A2D3B] mb-1.5">Coach Assessment</p>
                  <p className="text-xs text-[#17181C] leading-relaxed">
                    {session.coaching_report.overall_assessment}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {session.coaching_report.strengths?.length ? (
                  <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
                    <p className="text-[10px] font-mono uppercase text-emerald-700 mb-1.5">✓ Strengths</p>
                    <ul className="space-y-1">
                      {session.coaching_report.strengths.slice(0, 3).map((s, i) => (
                        <li key={i} className="text-[11px] text-emerald-900 leading-tight">· {s}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {session.coaching_report.gap_analysis?.length ? (
                  <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
                    <p className="text-[10px] font-mono uppercase text-amber-700 mb-1.5">⚠ To Improve</p>
                    <ul className="space-y-1">
                      {session.coaching_report.gap_analysis.slice(0, 3).map((g, i) => (
                        <li key={i} className="text-[11px] text-amber-900 leading-tight">· {g}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>

              {session.coaching_report.improvement_plan?.length ? (
                <div className="bg-white rounded-xl p-3 border border-[#17181C]/6">
                  <p className="text-[10px] font-mono uppercase text-[#7A2D3B] mb-2">📋 Next Steps</p>
                  <ol className="space-y-1 list-decimal list-inside">
                    {session.coaching_report.improvement_plan.map((step, i) => (
                      <li key={i} className="text-[11px] text-[#17181C] leading-tight">{step}</li>
                    ))}
                  </ol>
                </div>
              ) : null}

              {session.coaching_report.coach_final_note && (
                <p className="text-[11px] text-[#6B6D76] italic text-center border-t border-[#17181C]/6 pt-3">
                  &ldquo;{session.coaching_report.coach_final_note}&rdquo;
                </p>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default function HistoryScreen({ onBack, onNavigate, loggedIn, userEmail, onLogout }: HistoryScreenProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "excellent" | "recent">("all");
  const user = getCurrentUser();

  useEffect(() => {
    fetchSessions(50)
      .then((data) => setSessions(data.sessions || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const scores = sessions.map((s) => s.score);
  const avgScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const bestScore = scores.length ? Math.max(...scores) : 0;

  const filteredSessions = sessions.filter((s) => {
    const matchesSearch = !searchQuery.trim() || (s.topic && s.topic.toLowerCase().includes(searchQuery.toLowerCase()));
    if (!matchesSearch) return false;
    if (filterMode === "excellent") return s.score >= 80;
    return true;
  });

  const handleSelectSession = async (s: Session) => {
    if (!s.video_url) {
      setSelectedSession(s);
      return;
    }
    // Resolve the stored reference into a short-lived signed playback URL.
    const url = await resolveSessionVideoUrl(s.video_url).catch(() => null);
    setSelectedSession({ ...s, video_url: url || undefined });
  };

  if (selectedSession && selectedSession.full_analysis) {
    return (
      <ReviewScreen
        initialReport={selectedSession.full_analysis}
        initialVideoUrl={selectedSession.video_url}
        onBack={() => setSelectedSession(null)}
      />
    );
  }

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
              onClick={() => onNavigate("profile")}
              className="px-3 py-1.5 text-xs font-medium text-[#6B6D76] hover:text-[#17181C] rounded-full hover:bg-[#17181C]/8 transition-all cursor-pointer"
            >
              My Profile
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

      <main className="max-w-3xl mx-auto px-4 pt-28 pb-16">
        {/* Header */}
        <div className="mb-8">
          <p className="text-[10px] font-mono uppercase text-[#7A2D3B] tracking-widest mb-1">SESSION HISTORY</p>
          <h1 className="text-3xl font-bold text-[#17181C]">
            {user?.name ? `${user.name}'s Practice Journal` : "Your Practice Journal"}
          </h1>
          <p className="text-sm text-[#6B6D76] mt-1">Every session recorded, every improvement tracked.</p>
        </div>

        {/* Stats summary & Progression Chart */}
        {sessions.length > 0 && (
          <div className="bg-white rounded-2xl border border-[#17181C]/[0.08] p-5 sm:p-6 mb-6 shadow-sm">
            <div className="grid grid-cols-3 divide-x divide-[#17181C]/8">
              <div className="text-center px-4">
                <p className="text-2xl sm:text-3xl font-black text-[#17181C]">{sessions.length}</p>
                <p className="text-[10px] font-mono uppercase text-[#8B8C93] mt-0.5">Sessions</p>
              </div>
              <div className="text-center px-4">
                <p className="text-2xl sm:text-3xl font-black text-[#17181C]">{avgScore.toFixed(0)}</p>
                <p className="text-[10px] font-mono uppercase text-[#8B8C93] mt-0.5">Avg Score</p>
              </div>
              <div className="text-center px-4">
                <p className="text-2xl sm:text-3xl font-black text-[#059669]">{bestScore.toFixed(0)}</p>
                <p className="text-[10px] font-mono uppercase text-[#8B8C93] mt-0.5">Best Score</p>
              </div>
            </div>
            {scores.length > 1 && (
              <ScoreProgressionChart sessions={sessions} />
            )}
          </div>
        )}

        {/* Search & Filter Bar */}
        {sessions.length > 0 && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4">
            {/* Search Input */}
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search practice topics..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs bg-white border border-[#17181C]/[0.08] focus:border-[#7A2D3B]/40 focus:ring-2 focus:ring-[#7A2D3B]/10 rounded-full outline-none transition-all placeholder:text-[#8B8C93]"
              />
              <span className="absolute left-3 top-2.5 text-xs text-[#8B8C93]">🔍</span>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-2.5 text-xs text-[#8B8C93] hover:text-[#17181C]"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 bg-[#F6F6F7] p-1 rounded-full border border-[#17181C]/[0.06] shrink-0 self-start sm:self-auto">
              <button
                onClick={() => setFilterMode("all")}
                className={`px-3 py-1 text-xs font-semibold rounded-full transition-all cursor-pointer ${
                  filterMode === "all" ? "bg-white text-[#17181C] shadow-xs" : "text-[#6B6D76] hover:text-[#17181C]"
                }`}
              >
                All ({sessions.length})
              </button>
              <button
                onClick={() => setFilterMode("excellent")}
                className={`px-3 py-1 text-xs font-semibold rounded-full transition-all cursor-pointer ${
                  filterMode === "excellent" ? "bg-white text-[#059669] shadow-xs" : "text-[#6B6D76] hover:text-[#17181C]"
                }`}
              >
                ⭐ 80+ ({sessions.filter((s) => s.score >= 80).length})
              </button>
            </div>
          </div>
        )}

        {/* Session list */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-6 h-6 border-2 border-[#7A2D3B] border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-[#8B8C93] font-mono">Loading your sessions...</p>
          </div>
        )}

        {error && (
          <div className="text-center py-20">
            <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-2xl px-6 py-4">
              {error}
            </p>
          </div>
        )}

        {!loading && !error && sessions.length === 0 && (
          <div className="text-center py-20 space-y-3">
            <p className="text-4xl">🎤</p>
            <p className="text-xl font-bold text-[#17181C]">No sessions yet</p>
            <p className="text-sm text-[#6B6D76]">Complete your first practice session to see it here.</p>
            <button
              onClick={onBack}
              className="mt-4 bg-[#17181C] hover:bg-[#2b2c31] transition-colors text-white px-6 py-2.5 rounded-full text-xs font-semibold shadow-md cursor-pointer"
            >
              Start Practicing →
            </button>
          </div>
        )}

        {!loading && !error && sessions.length > 0 && filteredSessions.length === 0 && (
          <div className="text-center py-16 bg-white border border-[#17181C]/[0.08] rounded-2xl p-6">
            <p className="text-2xl mb-2">🔍</p>
            <p className="text-sm font-bold text-[#17181C]">No matching sessions found</p>
            <p className="text-xs text-[#8B8C93] mt-1">Try a different search term or clear the filter.</p>
            <button
              onClick={() => {
                setSearchQuery("");
                setFilterMode("all");
              }}
              className="mt-3 text-xs text-[#7A2D3B] font-semibold hover:underline"
            >
              Clear filters
            </button>
          </div>
        )}

        {!loading && !error && filteredSessions.length > 0 && (
          <div className="space-y-3">
            {filteredSessions.map((session) => {
              const id = session.session_id || session.id;
              return (
                <SessionCard 
                  key={id} 
                  session={session}
                  expanded={expandedId === id}
                  onToggleExpand={() => setExpandedId(expandedId === id ? null : id)}
                  onSelectSession={handleSelectSession}
                />
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}