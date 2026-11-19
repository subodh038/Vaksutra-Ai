"use client";

import AccountMenu from "./AccountMenu";

interface AboutScreenProps {
  onBack: () => void;
  onNavigate: (page: string) => void;
  loggedIn?: boolean;
  userEmail?: string;
  onLogout?: () => void;
}

const PIPELINE_STEPS = [
  {
    step: "01",
    title: "Prepare",
    desc: "Pick a module and get a live, AI-generated prompt — never the same question twice — with a short prep window before the camera starts.",
  },
  {
    step: "02",
    title: "Record",
    desc: "Practice in front of your own camera. On-device computer vision reads your gaze, pacing, and expression in real time as you speak.",
  },
  {
    step: "03",
    title: "Analyze",
    desc: "Acoustic and linguistic scoring across filler words, pacing, sentence structure, and vocal delivery — no guesswork, just numbers.",
  },
  {
    step: "04",
    title: "Coach",
    desc: "AI-generated feedback: what worked, what didn't, and sentence-level corrections you can actually apply next time.",
  },
];

const ROADMAP = [
  {
    name: "Impromptu Speaker",
    status: "Available Now",
    active: true,
    desc: "Spontaneous delivery practice with live gaze and pace metrics.",
  },
  {
    name: "Q&A Simulator",
    status: "Coming Soon",
    active: false,
    desc: "Field high-stakes questions under dynamic AI pressure.",
  },
  {
    name: "Presentation Engine",
    status: "Coming Soon",
    active: false,
    desc: "Long-form delivery with slide sync and posture detection.",
  },
  {
    name: "Feynman Technique",
    status: "Coming Soon",
    active: false,
    desc: "Explain complex concepts and analyze jargon density.",
  },
];

export default function AboutScreen({ onBack, onNavigate, loggedIn, userEmail, onLogout }: AboutScreenProps) {
  return (
    <div className="min-h-screen bg-white text-[#17181C] flex flex-col justify-between overflow-x-hidden animate-fade-in selection:bg-[#7A2D3B]/20">
      {/* ── FLOATING NAVBAR ───────────────────────────────── */}
      <div className="fixed top-4 left-0 right-0 z-50 flex justify-center px-4">
        <nav
          className="rounded-full px-6 py-2.5 flex items-center justify-between gap-6 w-full max-w-4xl border border-[#17181C]/[0.06] bg-white/80"
          style={{ backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", boxShadow: "0 8px 30px rgba(23,24,28,0.06)" }}
        >
          <button onClick={onBack} className="flex items-center gap-2 cursor-pointer shrink-0">
            <div className="w-7 h-7 rounded-full bg-[#17181C] flex items-center justify-center text-white font-black text-xs">
              V
            </div>
            <span className="font-semibold text-sm text-[#17181C] tracking-tight">
              VakSutra <span className="text-[#7A2D3B]">AI</span>
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-[#7A2D3B]/10 text-[#7A2D3B] border border-[#7A2D3B]/20 leading-none">
              Beta
            </span>
          </button>

          <div className="hidden md:flex items-center gap-1 text-sm font-medium text-[#6B6D76]">
            <button
              onClick={() => onNavigate("landing")}
              className="px-3 py-1.5 rounded-full hover:bg-[#17181C]/8 hover:text-[#17181C] transition-all cursor-pointer"
            >
              Home
            </button>
            <button
              onClick={() => onNavigate("modules")}
              className="px-3 py-1.5 rounded-full hover:bg-[#17181C]/8 hover:text-[#17181C] transition-all cursor-pointer"
            >
              Modules
            </button>
            <button
              onClick={() => onNavigate("resources")}
              className="px-3 py-1.5 rounded-full hover:bg-[#17181C]/8 hover:text-[#17181C] transition-all cursor-pointer"
            >
              Resources
            </button>
            {/*<button
              onClick={() => onNavigate("pricing")}
              className="px-3 py-1.5 rounded-full hover:bg-[#17181C]/8 hover:text-[#17181C] transition-all cursor-pointer"
            >
              Pricing
            </button>*/}
            <button
              onClick={() => onNavigate("about")}
              className="px-3 py-1.5 rounded-full bg-[#17181C] text-white transition-all cursor-pointer"
            >
              About
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {loggedIn ? (
              <AccountMenu userEmail={userEmail} onNavigate={onNavigate} onLogout={onLogout} />
            ) : (
              <>
                <button
                  onClick={() => onNavigate("auth")}
                  className="text-xs text-[#6B6D76] hover:text-[#17181C] font-medium px-3 py-1.5 rounded-full hover:bg-[#17181C]/5 transition-all cursor-pointer"
                >
                  Log in
                </button>
                <button
                  onClick={() => onNavigate("auth")}
                  className="bg-[#17181C] hover:bg-[#2b2c31] transition-colors text-white text-xs px-4 py-1.5 rounded-full font-semibold cursor-pointer shadow-xs"
                >
                  Sign up
                </button>
              </>
            )}
          </div>
        </nav>
      </div>

      <main className="max-w-4xl w-full mx-auto px-6 pt-32 pb-24">
        {/* ── HERO ─────────────────────────────────────────── */}
        <div className="text-center max-w-2xl mx-auto mb-20">
          <p className="text-[#7A2D3B] text-xs font-semibold uppercase tracking-[0.2em] mb-3">
            About VakSutra AI
          </p>
          <h1 className="text-4xl sm:text-6xl font-bold text-[#17181C] leading-tight mb-5 tracking-tight">
            The practice you can&apos;t get in a meeting room.
          </h1>
          <p className="text-[#6B6D76] text-base leading-relaxed">
            Most people prepare for high-stakes speaking moments the same way: alone, in their head, with no
            real feedback until it&apos;s already over. VakSutra AI gives you a place to actually rehearse —
            on demand, in private, with feedback that&apos;s specific instead of vague.
          </p>
        </div>

        {/* ── MISSION ──────────────────────────────────────── */}
        <section className="mb-20">
          <div className="bg-[#B5602F]/[0.06] border-l-2 border-[#B5602F] rounded-r-2xl p-8 sm:p-10">
            <p className="text-[#8A4322] text-xs font-semibold uppercase tracking-[0.16em] mb-4">
              Why we built this
            </p>
            <div className="flex items-center gap-[2px] h-4 mb-4" aria-hidden="true">
              {[0, 90, 180, 270, 360, 270, 180, 90, 0].map((delay, i) => (
                <span
                  key={i}
                  className="w-[2px] h-4 bg-[#B5602F] rounded-full"
                  style={{ animation: "waveform-pulse 1.1s ease-in-out infinite", animationDelay: `${delay}ms` }}
                />
              ))}
            </div>
            <p className="text-[17px] sm:text-lg text-[#17181C] leading-[1.6]">
              We built this because we hit the wall ourselves. First presentation, first interview — the
              kind you walk out of knowing something went wrong, but not what. Was it the pacing? The eye
              contact? That word you kept saying every ten seconds without noticing? Nobody tells you. You
              just feel worse the next time. VakSutra exists to finally answer that question — not with
              encouragement, but with an honest look at what actually happened.
            </p>
          </div>
        </section>

        {/* ── HOW IT WORKS ─────────────────────────────────── */}
        <section className="mb-20">
          <div className="text-center max-w-xl mx-auto mb-12">
            <p className="text-[#7A2D3B] text-xs font-semibold uppercase tracking-[0.16em] mb-3">
              How It Works
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#17181C] tracking-tight">
              One session, four stages.
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {PIPELINE_STEPS.map((s) => (
              <div
                key={s.step}
                className="bg-white rounded-2xl p-6 border border-[#17181C]/[0.08] flex gap-4"
              >
                <div className="w-10 h-10 rounded-2xl bg-[#17181C] text-white flex items-center justify-center font-mono font-bold text-xs shrink-0">
                  {s.step}
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#17181C] mb-1">{s.title}</h3>
                  <p className="text-xs text-[#6B6D76] leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── PRIVACY ──────────────────────────────────────── */}
        <section className="mb-20">
          <div className="bg-[#17181C] text-white rounded-3xl p-8 sm:p-12">
            <p className="text-[#E8A6B4] text-xs font-semibold uppercase tracking-[0.16em] mb-3">
              Privacy
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold mb-6 tracking-tight">
              What actually happens to your recording.
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div>
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center mb-3">
                  <svg className="w-4 h-4 text-[#E8A6B4]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </div>
                <h3 className="text-sm font-bold mb-1.5">Tracking runs locally</h3>
                <p className="text-xs text-[#A0A0A8] leading-relaxed">
                  Gaze, expression, and posture tracking run through on-device computer vision in your
                  browser — that analysis doesn&apos;t require sending your live video feed to a server to compute.
                </p>
              </div>
              <div>
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center mb-3">
                  <svg className="w-4 h-4 text-[#E8A6B4]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-sm font-bold mb-1.5">Saved to your account</h3>
                <p className="text-xs text-[#A0A0A8] leading-relaxed">
                  Your recording and its analysis are stored to your private account so Session History
                  works — nothing is shared publicly or with other users.
                </p>
              </div>
              <div>
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center mb-3">
                  <svg className="w-4 h-4 text-[#E8A6B4]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h3 className="text-sm font-bold mb-1.5">You choose when to practice</h3>
                <p className="text-xs text-[#A0A0A8] leading-relaxed">
                  Camera and microphone access is only requested when you start a session — never running
                  in the background.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── ROADMAP ──────────────────────────────────────── */}
        <section>
          <div className="text-center max-w-xl mx-auto mb-12">
            <p className="text-[#7A2D3B] text-xs font-semibold uppercase tracking-[0.16em] mb-3">
              What&apos;s Next
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#17181C] tracking-tight">
              One module live. Three more on the way.
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {ROADMAP.map((m) => (
              <div
                key={m.name}
                className={`rounded-2xl p-6 border flex flex-col ${
                  m.active
                    ? "bg-white border-[#7A2D3B]/25"
                    : "bg-[#F6F6F7] border-[#17181C]/[0.06]"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-bold text-[#17181C]">{m.name}</h3>
                  <span
                    className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded-full border ${
                      m.active
                        ? "text-[#7A2D3B] bg-[#7A2D3B]/10 border-[#7A2D3B]/20"
                        : "text-[#8B8C93] bg-white border-[#17181C]/[0.08]"
                    }`}
                  >
                    {m.status}
                  </span>
                </div>
                <p className="text-xs text-[#6B6D76] leading-relaxed">{m.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── CTA ──────────────────────────────────────────── */}
        <div className="text-center mt-20">
          <button
            onClick={onBack}
            className="bg-[#17181C] hover:bg-[#2b2c31] transition-colors text-white px-8 py-3.5 rounded-full text-sm font-semibold cursor-pointer"
          >
            Start Your Journey →
          </button>
        </div>
      </main>

      {/* ── FOOTER ───────────────────────────────────────── */}
      <footer className="bg-[#111114] py-8 px-6 border-t border-white/5 text-center">
        <span className="text-[#8B8C93] text-xs font-mono">
          © 2025 VakSutra AI. All rights reserved. • Enterprise-Grade Communication Intelligence
        </span>
      </footer>
    </div>
  );
}