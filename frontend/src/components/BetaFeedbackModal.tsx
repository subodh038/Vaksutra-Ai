"use client";

/**
 * BetaFeedbackModal — structured, section-wise beta review.
 * Sections: Ease of use → Report quality → AI Coach → Weakest area →
 *           NPS → Pricing intent → Open text. MCQ chips + star rating.
 */

import { useMemo, useState } from "react";

interface BetaFeedbackModalProps {
  onClose: () => void;
  onSubmitted?: () => void;
}

type Choice = { value: string; label: string };

const REPORT_USEFUL: Choice[] = [
  { value: "yes", label: "Yes, very" },
  { value: "somewhat", label: "Somewhat" },
  { value: "no", label: "Not really" },
];

const WEAK_AREAS: Choice[] = [
  { value: "eye_contact", label: "👀 Eye contact" },
  { value: "filler_words", label: "🗣️ Filler words" },
  { value: "pacing", label: "⏱️ Pacing / pauses" },
  { value: "confidence", label: "💪 Confidence signals" },
  { value: "structure", label: "🧱 Structure of answer" },
];

const PREMIUM_WORTH: Choice[] = [
  { value: "more_modes", label: "🎯 More modes (Q&A, interviews)" },
  { value: "history_tracking", label: "📈 Unlimited history & progress tracking" },
  { value: "deeper_coaching", label: "🧠 Deeper AI coaching" },
  { value: "nothing_free", label: "🆓 Nothing — keep it all free" },
];

function ChipGroup({
  options,
  value,
  onChange,
}: {
  options: Choice[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all cursor-pointer ${
            value === o.value
              ? "bg-[#7A2D3B] text-white border-[#7A2D3B] shadow-md shadow-[#7A2D3B]/30"
              : "bg-white/[0.04] text-[#A6A4AD] border-white/10 hover:border-white/25 hover:text-white hover:bg-white/[0.07]"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function BetaFeedbackModal({ onClose, onSubmitted }: BetaFeedbackModalProps) {
  const [step, setStep] = useState(0);
  const [ease, setEase] = useState(0);
  const [reportUseful, setReportUseful] = useState("");
  const [coachUseful, setCoachUseful] = useState("");
  const [weakArea, setWeakArea] = useState("");
  const [nps, setNps] = useState<number | null>(null);
  const [premiumWorth, setPremiumWorth] = useState("");
  const [biggestIssue, setBiggestIssue] = useState("");
  const [wantedFeature, setWantedFeature] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const canAdvance = useMemo(() => {
    if (step === 0) return ease > 0 && reportUseful && coachUseful;
    if (step === 1) return weakArea && nps !== null && premiumWorth;
    return biggestIssue.trim().length >= 3;
  }, [step, ease, reportUseful, coachUseful, weakArea, nps, premiumWorth, biggestIssue]);

  const submit = async () => {
    setSubmitting(true);
    setError("");
    try {
      const { fetchWithAuth } = await import("@/lib/auth");
      const { API_URL } = await import("@/lib/api");
      const res = await fetchWithAuth(`${API_URL}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ease_rating: ease,
          report_useful: reportUseful,
          coach_useful: coachUseful,
          weakest_area: weakArea,
          nps_score: nps,
          premium_worth: premiumWorth,
          biggest_issue: biggestIssue.trim(),
          wanted_feature: wantedFeature.trim() || null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      onSubmitted?.();
      setStep(3); // thank-you screen
    } catch {
      setError("Could not send feedback. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="w-full max-w-md bg-[#131117] rounded-2xl shadow-[0_25px_70px_rgba(0,0,0,0.85)] overflow-hidden border border-white/10 flex flex-col relative">
        {/* Subtle ambient wine glow in background */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 350px 180px at 50% 0%, rgba(122,45,59,0.3) 0%, transparent 80%)",
          }}
        />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 relative z-10 bg-[#16141C]/60">
          <div>
            <h2 className="font-semibold text-sm text-white tracking-tight">Beta Review</h2>
            <p className="text-[10px] text-[#8B8C93]">
              {step < 3 ? `Step ${step + 1} of 3` : "Done"}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close feedback"
            className="text-[#8B8C93] hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer text-base leading-none"
          >
            ✕
          </button>
        </div>

        {step === 0 && (
          <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto relative z-10">
            <div>
              <label className="block text-xs font-semibold text-white mb-2">
                How easy was the app to use?
              </label>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setEase(n)}
                    aria-label={`${n} star${n > 1 ? "s" : ""}`}
                    className={`text-xl leading-none cursor-pointer transition-all ${
                      n <= ease ? "drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]" : "grayscale opacity-30"
                    } hover:scale-110`}
                  >
                    ⭐
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-white mb-2">
                Was the diagnostic report useful?
              </label>
              <ChipGroup options={REPORT_USEFUL} value={reportUseful} onChange={setReportUseful} />
            </div>

            <div>
              <label className="block text-xs font-semibold text-white mb-2">
                Was the AI coaching report useful?
              </label>
              <ChipGroup options={REPORT_USEFUL} value={coachUseful} onChange={setCoachUseful} />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto relative z-10">
            <div>
              <label className="block text-xs font-semibold text-white mb-2">
                Which area does the app understand LEAST well? (your weakest signal)
              </label>
              <ChipGroup options={WEAK_AREAS} value={weakArea} onChange={setWeakArea} />
            </div>

            <div>
              <label className="block text-xs font-semibold text-white mb-2">
                How likely are you to recommend VakSutra to a friend? (0–10)
              </label>
              <div className="grid grid-cols-11 gap-1">
                {Array.from({ length: 11 }, (_, n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setNps(n)}
                    aria-label={`Score ${n}`}
                    className={`py-1.5 text-xs font-semibold rounded-md border transition-all cursor-pointer ${
                      nps === n
                        ? "bg-[#7A2D3B] text-white border-[#7A2D3B] shadow-md shadow-[#7A2D3B]/30"
                        : "bg-white/[0.04] text-[#A6A4AD] border-white/10 hover:border-[#7A2D3B]/50 hover:text-white"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-[#8B8C93] mt-1.5">0 = never · 10 = already told friends</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-white mb-2">
                If a premium tier existed, what would make it worth paying for?
              </label>
              <ChipGroup options={PREMIUM_WORTH} value={premiumWorth} onChange={setPremiumWorth} />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto relative z-10">
            <div>
              <label className="block text-xs font-semibold text-white mb-2">
                What almost stopped you from using the app? *
              </label>
              <textarea
                value={biggestIssue}
                onChange={(e) => setBiggestIssue(e.target.value)}
                rows={3}
                maxLength={1000}
                placeholder="Be brutal — this shapes what gets fixed next."
                className="w-full text-xs rounded-xl border border-white/10 bg-white/[0.04] text-white placeholder-[#6B6D76] p-3 focus:outline-none focus:border-[#7A2D3B] focus:ring-1 focus:ring-[#7A2D3B] resize-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-white mb-2">
                One feature you wish existed? (optional)
              </label>
              <input
                value={wantedFeature}
                onChange={(e) => setWantedFeature(e.target.value)}
                maxLength={500}
                placeholder="e.g., mock interview mode"
                className="w-full text-xs rounded-xl border border-white/10 bg-white/[0.04] text-white placeholder-[#6B6D76] p-3 focus:outline-none focus:border-[#7A2D3B] focus:ring-1 focus:ring-[#7A2D3B]"
              />
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
          </div>
        )}

        {step === 3 && (
          <div className="p-8 text-center relative z-10">
            <p className="text-3xl mb-3">🙏</p>
            <h3 className="font-semibold text-sm text-white mb-1.5">Thank you!</h3>
            <p className="text-xs text-[#A6A4AD] leading-relaxed">
              Your review goes straight to the builder. Top pain points get fixed first.
            </p>
            <button
              onClick={onClose}
              className="mt-5 px-5 py-2.5 text-xs font-semibold bg-[#7A2D3B] hover:bg-[#8F3545] text-white rounded-full cursor-pointer transition-all shadow-lg shadow-[#7A2D3B]/20 hover:scale-[1.02] active:scale-[0.98]"
            >
              Back to practicing
            </button>
          </div>
        )}

        {/* Footer nav */}
        {step < 3 && (
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-white/10 bg-[#0E0D12] relative z-10">
            <button
              onClick={() => (step === 0 ? onClose() : setStep(step - 1))}
              className="text-xs text-[#A6A4AD] hover:text-white cursor-pointer transition-colors"
            >
              {step === 0 ? "Cancel" : "← Back"}
            </button>
            <button
              disabled={!canAdvance || submitting}
              onClick={() => (step === 2 ? submit() : setStep(step + 1))}
              className={`px-5 py-2 text-xs font-semibold rounded-full transition-all cursor-pointer ${
                canAdvance && !submitting
                  ? "bg-[#7A2D3B] text-white hover:bg-[#8F3545] shadow-md shadow-[#7A2D3B]/30 hover:scale-[1.02] active:scale-[0.98]"
                  : "bg-white/5 text-[#5A5C63] border border-white/5 cursor-not-allowed"
              }`}
            >
              {submitting ? "Sending…" : step === 2 ? "Send Review" : "Next →"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
