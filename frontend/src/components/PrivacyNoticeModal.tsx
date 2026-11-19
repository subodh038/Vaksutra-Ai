"use client";

/**
 * PrivacyNoticeModal — Transparent data & privacy disclosure for beta users.
 * Explains on-device vision, private storage solely for self-review in History,
 * zero AI model training, and frames video retention as an open beta experiment.
 */

import { useEffect } from "react";

interface PrivacyNoticeModalProps {
  isOpen?: boolean;
  onClose: () => void;
  onOpenFeedback?: () => void;
}

export default function PrivacyNoticeModal({
  isOpen = true,
  onClose,
  onOpenFeedback,
}: PrivacyNoticeModalProps) {
  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="w-full max-w-lg bg-[#131117] rounded-2xl shadow-[0_25px_70px_rgba(0,0,0,0.85)] overflow-hidden border border-white/10 flex flex-col relative">
        {/* Subtle ambient wine glow in background */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 350px 180px at 50% 0%, rgba(122,45,59,0.3) 0%, transparent 80%)",
          }}
        />

        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between relative z-10 bg-[#16141C]/60">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#7A2D3B]/20 text-[#E5989B] border border-[#7A2D3B]/35 text-[10px] font-mono font-bold uppercase tracking-wider mb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#E5989B] animate-pulse" />
              Beta Transparency Guarantee
            </div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
              Privacy &amp; How Your Data Works
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close privacy notice"
            className="text-[#8B8C93] hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 space-y-4 max-h-[72vh] overflow-y-auto relative z-10">
          <p className="text-xs sm:text-sm text-[#A6A4AD] leading-relaxed">
            Before you record your practice reps, here is our transparent, zero-fine-print commitment on how your voice and video are handled:
          </p>

          <div className="grid gap-3">
            {/* Pillar 1: On-Device Vision */}
            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08] hover:border-white/15 transition-colors flex items-start gap-3">
              <span className="text-xl shrink-0 p-1.5 bg-white/[0.05] rounded-lg border border-white/10">
                💻
              </span>
              <div>
                <h3 className="text-xs sm:text-sm font-semibold text-white">
                  100% On-Device Facial Analysis
                </h3>
                <p className="text-[11px] sm:text-xs text-[#9E9CA5] mt-0.5 leading-relaxed">
                  Your facial landmarks, eye contact, and expression metrics are processed locally inside your browser via MediaPipe. Live camera frames are never streamed to an AI server.
                </p>
              </div>
            </div>

            {/* Pillar 2: Private Vault */}
            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08] hover:border-white/15 transition-colors flex items-start gap-3">
              <span className="text-xl shrink-0 p-1.5 bg-white/[0.05] rounded-lg border border-white/10">
                🔒
              </span>
              <div>
                <h3 className="text-xs sm:text-sm font-semibold text-white">
                  Private Vault for History Playback Only
                </h3>
                <p className="text-[11px] sm:text-xs text-[#9E9CA5] mt-0.5 leading-relaxed">
                  Your recorded session is stored in an encrypted, private cloud vault solely so you can review your own playback in Session History. Only your authenticated account can generate short-lived playback URLs.
                </p>
              </div>
            </div>

            {/* Pillar 3: Zero AI Training */}
            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08] hover:border-white/15 transition-colors flex items-start gap-3">
              <span className="text-xl shrink-0 p-1.5 bg-white/[0.05] rounded-lg border border-white/10">
                🛡️
              </span>
              <div>
                <h3 className="text-xs sm:text-sm font-semibold text-white">
                  Zero AI Model Training &amp; Never Sold
                </h3>
                <p className="text-[11px] sm:text-xs text-[#9E9CA5] mt-0.5 leading-relaxed">
                  We will never sell or share your video, audio, or transcripts. We will never use your recordings or personal speaking patterns to train public AI models.
                </p>
              </div>
            </div>

            {/* Pillar 4: Beta Co-Creation */}
            <div className="p-3.5 rounded-xl bg-[#7A2D3B]/10 border border-[#7A2D3B]/30 hover:border-[#7A2D3B]/50 transition-colors flex items-start gap-3">
              <span className="text-xl shrink-0 p-1.5 bg-[#7A2D3B]/20 rounded-lg border border-[#7A2D3B]/40">
                🤝
              </span>
              <div>
                <h3 className="text-xs sm:text-sm font-semibold text-[#E5989B]">
                  Beta Experiment: You Decide Video&apos;s Future
                </h3>
                <p className="text-[11px] sm:text-xs text-[#C8C2CC] mt-0.5 leading-relaxed">
                  Video retention in History is an active test. If you and other beta testers prefer complete ephemeral privacy without video storage, tell us — we will gladly make the app completely video-free or delete your recordings on request.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer / Actions */}
        <div className="px-6 py-4 border-t border-white/10 bg-[#0E0D12] flex flex-col sm:flex-row items-center justify-between gap-3 relative z-10">
          {onOpenFeedback ? (
            <button
              type="button"
              onClick={onOpenFeedback}
              className="text-xs text-[#A6A4AD] hover:text-[#E5989B] underline underline-offset-2 transition-colors cursor-pointer text-center sm:text-left"
            >
              Have thoughts on this? Give beta feedback
            </button>
          ) : (
            <span className="text-[11px] text-[#8B8C93]">
              VakSutra AI Beta Transparency
            </span>
          )}

          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 rounded-full bg-[#7A2D3B] hover:bg-[#8F3545] text-white text-xs font-semibold transition-all cursor-pointer shadow-lg shadow-[#7A2D3B]/20 hover:scale-[1.02] active:scale-[0.98] text-center"
          >
            Got it — Let&apos;s Practice
          </button>
        </div>
      </div>
    </div>
  );
}
