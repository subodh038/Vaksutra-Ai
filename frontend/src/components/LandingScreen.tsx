"use client";

import { useState, useEffect } from "react";
import AccountMenu from "./AccountMenu";

interface LandingScreenProps {
  onSelectImpromptu: (topic?: string) => void;
  onNavigate?: (page: string, mode?: "login" | "signup") => void;
  loggedIn?: boolean;
  userEmail?: string;
  onLogout?: () => void;
  scrollTarget?: string | null;
  onScrollTargetHandled?: () => void;
  onOpenPrivacyNotice?: () => void;
}

/* ── Design tokens (this page only) ──────────────────────────
   ink        #17181C  primary text / primary buttons
   ink-soft   #6B6D76  secondary text
   paper      #FFFFFF  base background
   paper-alt  #F6F6F7  alternating section background
   accent     #7A2D3B  deep wine — used sparingly (labels, active
              states, chart strokes, checkmarks). Everything else
              stays neutral so the accent keeps its weight.
   Headline face: Inter only, carried by size/weight/tracking —
   no serif, no italics.
──────────────────────────────────────────────────────────── */

const MODULES = [
  {
    id: "impromptu",
    code: "MOD-01",
    name: "Impromptu Speaker",
    tagline: "Spontaneous Delivery",
    desc: "Respond to unexpected prompts with live gaze and pace metrics.",
    active: true,
    icon: "💬",
    badge: "Launch Session →",
  },
  {
    id: "qa",
    code: "MOD-02",
    name: "Q&A Simulator",
    tagline: "Rapid Interruption",
    desc: "Field high-stakes questions under dynamic AI pressure.",
    active: false,
    icon: "⚡",
    badge: "Coming Soon",
  },
  {
    id: "presentation",
    code: "MOD-03",
    name: "Presentation Engine",
    tagline: "Slide Pacing",
    desc: "Long-form delivery with slide sync and posture detection.",
    active: false,
    icon: "🎯",
    badge: "Coming Soon",
  },
  {
    id: "feynman",
    code: "MOD-04",
    name: "Feynman Technique",
    tagline: "Concept Simplicity",
    desc: "Explain complex concepts and analyze jargon density.",
    active: false,
    icon: "🧠",
    badge: "Coming Soon",
  },
];

// One of these is picked at random on each page load for the split-section
// illustration. Filenames 1,2,4-8 are placeholders following the known
// pattern from illus_3 — swap in your actual filenames.
const HERO_ILLUSTRATIONS = [
  "/illustrations/illus_1_playful_lineart.jpg",
  "/illustrations/illus_2_playful_lineart.jpg",
  "/illustrations/illus_3_playful_lineart.jpg",
  "/illustrations/illus_4_playful_lineart.jpg",
  "/illustrations/illus_5_playful_lineart.jpg",
  "/illustrations/illus_6_playful_lineart.jpg",
  "/illustrations/illus_7_playful_lineart.jpg",
  "/illustrations/illus_8_playful_lineart.jpg",
];

const FAQS = [
  {
    q: "Is my practice data private?",
    a: "Yes. Visual analysis runs entirely on your device — your camera frames never leave your browser. Audio is sent over an encrypted connection solely to generate your coaching report, and your practice data is never shared or made publicly accessible.",
  },
  {
    q: "What can I practice with VakSutra?",
    a: "Impromptu Speaking is live today. Q&A Simulator, Presentation Engine, and the Feynman Technique module are in progress and will unlock as they ship.",
  },
  {
    q: "Do I need any special equipment?",
    a: "No — just your device's camera and microphone. There's nothing extra to install or plug in.",
  },
  {
    q: "How is my speaking score calculated?",
    a: "We combine gaze, pace, and tone signals captured during your session into a small set of metrics you can track from one session to the next.",
  },
];

const WHY_FEATURES = [
  {
    tag: "Privacy First",
    title: "On-Device Processing",
    description: "Zero raw video uploaded without consent. All computer vision telemetry runs locally in your browser.",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
  },
  {
    tag: "Adaptive AI",
    title: "Dynamic Regimens",
    description: "Personalized exercise routines and challenge levels that automatically evolve as your delivery improves.",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
  },
  {
    tag: "Real-Time",
    title: "Actionable Telemetry",
    description: "Precise acoustic and visual feedback tracking pacing, pauses, eye contact, and vocal variety.",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
  },
  {
    tag: "Exact Quotes",
    title: "Contextual Rewrites",
    description: "Concrete before-and-after corrections quoting your exact words, never vague or generic advice.",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
      </svg>
    ),
  },
];

// Animated waveform SVG component
function WaveformVisualizer() {
  const bars = [3, 5, 8, 12, 9, 6, 14, 10, 7, 11, 8, 5, 4, 9, 13, 7, 5, 3];
  return (
    <div className="flex items-center justify-center gap-[3px] h-8">
      {bars.map((h, i) => (
        <div
          key={i}
          className="rounded-full bg-[#c96a7a] opacity-70"
          style={{
            width: "3px",
            height: `${h}px`,
            animation: `waveform-pulse ${0.8 + (i % 5) * 0.15}s ease-in-out infinite`,
            animationDelay: `${i * 60}ms`,
          }}
        />
      ))}
    </div>
  );
}

// Hook for scroll-triggered section reveals
function useScrollReveal() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            observer.unobserve(entry.target);
          }
        });
      },
      // Reveal just before a section reaches the viewport (not once it's already
      // 12% inside it) so tall sections like the final CTA don't render as a
      // blank gap while you're still scrolling toward them.
      { threshold: 0, rootMargin: "0px 0px 200px 0px" }
    );
    document.querySelectorAll(".section-reveal").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}

export default function LandingScreen({ onSelectImpromptu, onNavigate, loggedIn, userEmail, onLogout, scrollTarget, onScrollTargetHandled, onOpenPrivacyNotice }: LandingScreenProps) {
  const [navScrolled, setNavScrolled] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [activeNavTab, setActiveNavTab] = useState<string | null>(null);
  // Default to the known-working image for first paint (server-rendered
  // and client's initial render must match, or React throws a hydration
  // mismatch) — then swap to a random pick once we're safely client-side.
  const [heroIllustration, setHeroIllustration] = useState(HERO_ILLUSTRATIONS[2]);
  useEffect(() => {
    const idx = Math.floor(Math.random() * HERO_ILLUSTRATIONS.length);
    setHeroIllustration(HERO_ILLUSTRATIONS[idx]);
  }, []);
  useScrollReveal();

  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  // Consume a scroll target handed off from another screen (e.g. clicking
  // "Modules" while on Resources/Pricing/About navigates here first).
  useEffect(() => {
    if (!scrollTarget) return;
    setActiveNavTab(scrollTarget);
    const t = setTimeout(() => {
      scrollToSection(scrollTarget);
      onScrollTargetHandled?.();
    }, 50);
    return () => clearTimeout(t);
  }, [scrollTarget]);

  const navBtnClass = (key: string) =>
    `px-3 py-1.5 rounded-full transition-all cursor-pointer ${
      activeNavTab === key
        ? "bg-[#17181C] text-white"
        : "hover:bg-[#17181C]/5 hover:text-[#17181C]"
    }`;

  const handleStartSession = () => {
    // Always let the AI generate a fresh topic — no preset fallbacks.
    onSelectImpromptu();
  };

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">
      {/* ── FLOATING GLASS NAVBAR ─────────────────────────── */}
      <div className="fixed top-4 left-0 right-0 z-50 flex justify-center px-4">
        <nav
          className={`rounded-full px-5 py-2.5 flex items-center justify-between gap-4 w-full max-w-4xl border border-[#17181C]/[0.06] transition-all duration-300 ${
            navScrolled ? "bg-white/90 shadow-[0_8px_30px_rgba(23,24,28,0.08)]" : "bg-white/70"
          }`}
          style={{ backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}
        >
          {/* Left: Logo */}
          <button
            onClick={() => {
              setActiveNavTab("home");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="flex items-center gap-2 cursor-pointer shrink-0"
          >
            <div className="w-7 h-7 rounded-full bg-[#17181C] flex items-center justify-center text-white font-bold text-xs">
              V
            </div>
            <span className="font-semibold text-sm text-[#17181C] tracking-tight">
              VakSutra <span className="text-[#7A2D3B]">AI</span>
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-[#7A2D3B]/10 text-[#7A2D3B] border border-[#7A2D3B]/20 leading-none">
              Beta
            </span>
          </button>

          {/* Center: Nav links */}
          <div className="hidden md:flex items-center gap-1 text-sm font-medium text-[#6B6D76]">
            <button
              onClick={() => {
                setActiveNavTab("home");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className={navBtnClass("home")}
            >
              Home
            </button>
            <button
              onClick={() => {
                setActiveNavTab("modules");
                scrollToSection("modules");
              }}
              className={navBtnClass("modules")}
            >
              Modules
            </button>
            <button
              onClick={() => {
                setActiveNavTab("resources");
                onNavigate ? onNavigate("resources") : scrollToSection("modules");
              }}
              className={navBtnClass("resources")}
            >
              Resources
            </button>
            {/*<button
              onClick={() => {
                setActiveNavTab("pricing");
                onNavigate ? onNavigate("pricing") : scrollToSection("modules");
              }}
              className={navBtnClass("pricing")}
            >
              Pricing
            </button>*/}
            <button
              onClick={() => {
                setActiveNavTab("about");
                onNavigate ? onNavigate("about") : scrollToSection("about");
              }}
              className={navBtnClass("about")}
            >
              About
            </button>
          </div>

          {/* Right: Auth actions */}
          <div className="flex items-center gap-2 shrink-0">
            {loggedIn ? (
              <AccountMenu userEmail={userEmail} onNavigate={onNavigate} onLogout={onLogout} />
            ) : (
              <>
                <button
                  onClick={() => (onNavigate ? onNavigate("auth", "login") : handleStartSession())}
                  className="text-xs text-[#6B6D76] hover:text-[#17181C] font-medium px-3 py-1.5 rounded-full hover:bg-[#17181C]/5 transition-all cursor-pointer"
                >
                  Log in
                </button>
                <button
                  onClick={() => (onNavigate ? onNavigate("auth", "signup") : handleStartSession())}
                  className="bg-[#17181C] text-white text-xs px-4 py-1.5 rounded-full font-semibold cursor-pointer hover:bg-[#2b2c31] transition-colors"
                >
                  Sign up
                </button>
              </>
            )}
          </div>
        </nav>
      </div>

      {/* ── HERO (dark) ──────────────────────────────── */}
      <section className="pt-60 pb-40 px-8 bg-[#121014] relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 900px 500px at 50% -15%, rgba(122,45,59,0.45) 0%, transparent 72%), radial-gradient(ellipse 500px 300px at 85% 90%, rgba(122,45,59,0.16) 0%, transparent 70%)",
          }}
        />
        <div className="max-w-3xl mx-auto text-center relative z-10">
          <div className="animate-fade-up inline-flex items-center gap-2 mb-7 px-3 py-1 rounded-full bg-[#c96a7a]/10 border border-[#c96a7a]/25">
            <span className="w-1.5 h-1.5 rounded-full bg-[#c96a7a]" />
            <span className="text-[#c96a7a] text-[11px] font-semibold uppercase tracking-[0.16em]">
              Public Beta • AI-Powered Communication Coach
            </span>
          </div>

          <h1 className="animate-fade-up delay-100 leading-[1.08] mb-6">
            <span className="font-serif font-bold not-italic text-[38px] sm:text-6xl lg:text-[68px] text-white block">
              Never go blank
            </span>
            <span className="font-serif italic text-[38px] sm:text-6xl lg:text-[68px] text-[#c96a7a] block">
              on the spot again.
            </span>
          </h1>

          <p className="animate-fade-up delay-200 text-[#9a989e] text-lg max-w-xl mx-auto leading-relaxed mb-10">
            VakSutra is your personal AI speaking coach. Speak for 2 minutes on camera and get an honest score on eye contact, filler words, pacing, and confidence — free, in your browser, and your video never leaves your device.
          </p>

          <div className="animate-fade-up delay-300 flex flex-col sm:flex-row items-center justify-center gap-3 mb-12">
            <button
              onClick={() => scrollToSection("modules")}
              className="bg-white text-[#121014] px-8 py-3.5 rounded-full text-sm font-semibold cursor-pointer hover:bg-[#F0F0F0] transition-colors w-full sm:w-auto"
            >
              Start practicing free →
            </button>
            <button
              onClick={() => scrollToSection("methodology")}
              className="text-white text-sm font-semibold px-5 py-3.5 rounded-full border border-white/15 hover:bg-white/5 transition-colors cursor-pointer w-full sm:w-auto"
            >
              See how it works ↓
            </button>
          </div>

          <div className="animate-fade-up delay-400 flex justify-center">
            <WaveformVisualizer />
          </div>
        </div>
      </section>

      {/* ── PRACTICE MODULES (dedicated selection, not an embedded mockup) ─── */}
      <section id="modules" className="section-reveal bg-black overflow-hidden">
        <div className="bg-[#F6F6F7]  pt-24 pb-24">
          <div className="max-w-3xl mx-auto text-center mb-12 px-6">
          <p className="text-[#7A2D3B] text-xs font-semibold uppercase tracking-[0.16em] mb-3">Practice Modules</p>
          <h2 className="text-3xl sm:text-5xl font-bold text-[#17181C] tracking-tight leading-tight mb-4">
            Choose your practice mode.
          </h2>
          <p className="text-[#6B6D76] text-base max-w-xl mx-auto leading-relaxed">
            Start a live session now, or see what&rsquo;s coming next.
          </p>
        </div>

        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-wrap justify-center gap-5">
          {MODULES.map((mod) => (
            <div
              key={mod.code}
              onClick={() => mod.active && handleStartSession()}
              role={mod.active ? "button" : undefined}
              tabIndex={mod.active ? 0 : undefined}
              onKeyDown={(e) => {
                if (mod.active && (e.key === "Enter" || e.key === " ")) handleStartSession();
              }}
              style={{ scrollSnapAlign: "start" }}
              className={`shrink-0 w-[250px] sm:w-[270px] rounded-2xl p-6 border flex flex-col bg-white transition-all select-none ${
                mod.active
                  ? "border-[#7A2D3B]/25 shadow-[0_16px_40px_-20px_rgba(122,45,59,0.28)] cursor-pointer hover:border-[#7A2D3B]/45 hover:-translate-y-0.5"
                  : "border-[#17181C]/[0.07] opacity-70 cursor-not-allowed"
              }`}
            >
              <div className="flex items-center justify-between mb-5">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${
                    mod.active ? "bg-[#7A2D3B]/10" : "bg-[#17181C]/[0.04]"
                  }`}
                >
                  {mod.icon}
                </div>
                <span
                  className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                    mod.active
                      ? "text-[#7A2D3B] bg-[#7A2D3B]/10 border-[#7A2D3B]/20"
                      : "text-[#8B8C93] bg-[#17181C]/[0.04] border-[#17181C]/[0.06]"
                  }`}
                >
                  {mod.active ? "Available Now" : "Coming Soon"}
                </span>
              </div>

              <div className="text-[9px] font-mono text-[#8B8C93] mb-1.5 tracking-wider">{mod.code}</div>
              <h3 className="text-base font-bold text-[#17181C] mb-1">{mod.name}</h3>
              <p className={`text-xs font-medium mb-2 ${mod.active ? "text-[#7A2D3B]" : "text-[#8B8C93]"}`}>
                {mod.tagline}
              </p>
              <p className="text-xs text-[#6B6D76] leading-relaxed mb-5 flex-1">{mod.desc}</p>

              {mod.active ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-[#17181C] px-4 py-2 rounded-full w-fit">
                  Launch Session →
                </span>
              ) : (
                <span className="text-[11px] text-[#8B8C93] font-medium">You&rsquo;ll be notified when this ships</span>
              )}
            </div>
          ))}
         </div>
        </div>
      </div>
      </section>

      {/* ── METHODOLOGY ───────────────────────────────── */}
      <section id="methodology" className="section-reveal py-24 px-6 bg-[#F6F6F7]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[#7A2D3B] text-xs font-semibold uppercase tracking-[0.16em] mb-3">The Methodology</p>
            <h2 className="text-3xl sm:text-5xl font-bold text-[#17181C] tracking-tight leading-tight">
              Elevate every interaction
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1: Real-time Analysis — Circular progress rings */}
            <div className="bg-white border border-[#17181C]/[0.07] rounded-2xl p-7 flex flex-col">
              <h3 className="text-xl font-bold text-[#17181C] mb-1">Real-time Analysis</h3>
              <p className="text-[#8B8C93] text-xs mb-6 leading-relaxed">Live multi-modal feedback during every session.</p>

              <div className="flex items-center justify-around mb-6">
                {[
                  { label: "Gaze", pct: 94, color: "#7A2D3B" },
                  { label: "Pace", pct: 78, color: "#17181C" },
                  { label: "Tone", pct: 86, color: "#7A2D3B" },
                ].map(({ label, pct, color }) => {
                  const r = 26,
                    circ = 2 * Math.PI * r;
                  const dash = (pct / 100) * circ;
                  return (
                    <div key={label} className="flex flex-col items-center gap-2">
                      <svg width="68" height="68" viewBox="0 0 68 68">
                        <circle cx="34" cy="34" r={r} fill="none" stroke="#EDEDEF" strokeWidth="5" />
                        <circle
                          cx="34"
                          cy="34"
                          r={r}
                          fill="none"
                          stroke={color}
                          strokeWidth="5"
                          strokeDasharray={`${dash} ${circ}`}
                          strokeLinecap="round"
                          transform="rotate(-90 34 34)"
                        />
                        <text x="34" y="38" textAnchor="middle" fontSize="13" fontWeight="700" fill="#17181C">
                          {pct}%
                        </text>
                      </svg>
                      <span className="text-[10px] font-semibold text-[#6B6D76] uppercase tracking-wider">{label}</span>
                    </div>
                  );
                })}
              </div>

              <div className="mt-auto border-t border-[#17181C]/[0.06] pt-4 grid grid-cols-2 gap-3">
                {[
                  { label: "Filler words", value: "2 / min" },
                  { label: "Inference", value: "< 4 ms" },
                ].map((s) => (
                  <div key={s.label} className="bg-[#7A2D3B]/[0.05] rounded-xl p-3 text-center">
                    <div className="text-base font-bold text-[#17181C]">{s.value}</div>
                    <div className="text-[10px] text-[#8B8C93] mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Card 2: Confidence Metrics — SVG line chart */}
            <div className="bg-white border border-[#17181C]/[0.07] rounded-2xl p-7 flex flex-col">
              <h3 className="text-xl font-bold text-[#17181C] mb-1">Confidence Metrics</h3>
              <p className="text-[#8B8C93] text-xs mb-5 leading-relaxed">Track your authority score across sessions.</p>

              <div className="relative flex-1 min-h-[120px]">
                <svg viewBox="0 0 220 100" className="w-full h-full overflow-visible">
                  {[20, 50, 80].map((y) => (
                    <line key={y} x1="0" y1={y} x2="220" y2={y} stroke="#EDEDEF" strokeWidth="1" strokeDasharray="4 3" />
                  ))}
                  <defs>
                    <linearGradient id="confGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#7A2D3B" stopOpacity="0.16" />
                      <stop offset="100%" stopColor="#7A2D3B" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d="M0,80 C30,75 50,62 75,55 S110,40 140,30 S175,20 220,12 L220,100 L0,100 Z" fill="url(#confGrad)" />
                  <path
                    d="M0,80 C30,75 50,62 75,55 S110,40 140,30 S175,20 220,12"
                    fill="none"
                    stroke="#7A2D3B"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  {[[0, 80], [75, 55], [140, 30], [220, 12]].map(([x, y], i) => (
                    <circle key={i} cx={x} cy={y} r="4" fill="#7A2D3B" stroke="white" strokeWidth="2" />
                  ))}
                  {[["Low", 80], ["Mid", 50], ["High", 20]].map(([lbl, y]) => (
                    <text key={String(lbl)} x="222" y={Number(y) + 4} fontSize="8" fill="#8B8C93">
                      {lbl}
                    </text>
                  ))}
                </svg>
              </div>

              <div className="flex justify-between text-[9px] text-[#8B8C93] px-1 mt-1 mb-5">
                {["Wk 1", "Wk 2", "Wk 3", "Wk 4"].map((w) => (
                  <span key={w}>{w}</span>
                ))}
              </div>

              <div className="mt-auto border-t border-[#17181C]/[0.06] pt-4 grid grid-cols-2 gap-3">
                {[
                  { label: "Metrics tracked", value: "20+" },
                  { label: "Report latency", value: "Instant" },
                ].map((s) => (
                  <div key={s.label} className="bg-[#7A2D3B]/[0.05] rounded-xl p-3 text-center">
                    <div className="text-base font-bold text-[#17181C]">{s.value}</div>
                    <div className="text-[10px] text-[#8B8C93] mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Card 3: Vocal Clarity — Animated EQ bars */}
            <div className="bg-white border border-[#17181C]/[0.07] rounded-2xl p-7 flex flex-col">
              <h3 className="text-xl font-bold text-[#17181C] mb-1">Vocal Clarity</h3>
              <p className="text-[#8B8C93] text-xs mb-5 leading-relaxed">Audio spectrum and articulation analysis in real-time.</p>

              <div className="flex items-end justify-center gap-1.5 h-24 mb-3">
                {[40, 65, 50, 80, 55, 90, 60, 75, 45, 85, 70, 50, 65, 40, 78, 55, 88, 62].map((h, i) => (
                  <div
                    key={i}
                    className="rounded-full flex-1 max-w-[10px]"
                    style={{
                      height: `${h}%`,
                      background: i % 2 === 0 ? "#7A2D3B" : "#17181C33",
                      animation: `waveform-pulse ${0.9 + (i % 5) * 0.18}s ease-in-out infinite`,
                      animationDelay: `${i * 70}ms`,
                    }}
                  />
                ))}
              </div>

              <div className="flex justify-between text-[9px] text-[#8B8C93] px-1 mb-5">
                {["80Hz", "250Hz", "1kHz", "4kHz", "8kHz"].map((f) => (
                  <span key={f}>{f}</span>
                ))}
              </div>

              <div className="mt-auto border-t border-[#17181C]/[0.06] pt-4 grid grid-cols-2 gap-3">
                {[
                  { label: "WPM optimal", value: "142" },
                  { label: "Pitch variation", value: "High" },
                ].map((s) => (
                  <div key={s.label} className="bg-[#7A2D3B]/[0.05] rounded-xl p-3 text-center">
                    <div className="text-base font-bold text-[#17181C]">{s.value}</div>
                    <div className="text-[10px] text-[#8B8C93] mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SPLIT PRODUCT SECTION (dark — the middle rhythm break) ──── */}
      <section id="about" className="section-reveal py-24 px-6 bg-[#121014] relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.5]"
          style={{ background: "radial-gradient(ellipse 700px 400px at 15% 50%, rgba(122,45,59,0.18) 0%, transparent 70%)" }}
        />
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center relative z-10">
          <div className="flex items-center justify-center order-2 lg:order-1">
            <div className="relative" style={{ filter: "drop-shadow(0 25px 48px rgba(0,0,0,0.4))" }}>
              <div
                className="absolute inset-0 rounded-full scale-75 -translate-x-4 translate-y-4 opacity-20"
                style={{ background: "radial-gradient(circle, #c96a7a 0%, transparent 70%)" }}
              />
              <img
                src={heroIllustration}
                alt="Person speaking confidently with AI coaching"
                className="relative z-10 w-full max-w-md object-contain rounded-2xl"
              />
            </div>
          </div>

          <div className="order-1 lg:order-2">
            <p className="text-[#c96a7a] text-xs font-semibold uppercase tracking-[0.16em] mb-4">
              Designed for the Modern Professional
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight leading-tight mb-6">
              Your private AI coaching partner.
            </h2>
            <p className="text-[#9a989e] text-base leading-relaxed mb-8">
              Our platform integrates seamlessly into your workflow. Whether you&rsquo;re leading a board meeting or
              delivering a keynote, VakSutra provides the discreet coaching you need to project quiet authority.
            </p>
            <div className="grid grid-cols-3 gap-4 pt-6 border-t border-white/[0.1]">
              <div>
                <div className="text-2xl font-bold text-white">2 min</div>
                <div className="text-xs text-[#8B8C93] mt-0.5">Setup time</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-white">0</div>
                <div className="text-xs text-[#8B8C93] mt-0.5">Human reviewers</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-white">24/7</div>
                <div className="text-xs text-[#8B8C93] mt-0.5">Practice on your schedule</div>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* ── WHY VOCALYZE ──────────────────────────────── */}
      <section className="section-reveal py-24 px-6 bg-[#F6F6F7]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-[#7A2D3B] text-xs font-semibold uppercase tracking-[0.16em] mb-3">Why VakSutra</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#17181C] tracking-tight">
              Built for how you actually practice.
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {WHY_FEATURES.map((feat, i) => (
              <div
                key={i}
                className="group relative bg-white border border-[#17181C]/[0.08] hover:border-[#7A2D3B]/30 rounded-2xl p-6 sm:p-7 shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <div className="w-11 h-11 rounded-xl bg-[#7A2D3B]/[0.07] group-hover:bg-[#7A2D3B] text-[#7A2D3B] group-hover:text-white flex items-center justify-center transition-colors duration-300">
                      {feat.icon}
                    </div>
                    <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[#7A2D3B] bg-[#7A2D3B]/[0.08] px-2.5 py-1 rounded-full">
                      {feat.tag}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-[#17181C] mb-2 group-hover:text-[#7A2D3B] transition-colors">
                    {feat.title}
                  </h3>
                  <p className="text-[#6B6D76] text-xs leading-relaxed">
                    {feat.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ────────────────────────────────────────
          Starter copy grounded in what the product already does —
          worth a pass to confirm wording matches your voice. */}
      <section className="section-reveal py-24 px-6 bg-[#F6F6F7]">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-[#7A2D3B] text-xs font-semibold uppercase tracking-[0.16em] mb-3">FAQ</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#17181C] tracking-tight">Frequently asked questions</h2>
          </div>
          <div className="space-y-3">
            {FAQS.map((item, i) => {
              const open = openFaq === i;
              return (
                <div key={item.q} className="bg-white border border-[#17181C]/[0.07] rounded-2xl overflow-hidden">
                  <button
                    onClick={() => setOpenFaq(open ? null : i)}
                    className="w-full flex items-center justify-between gap-4 text-left px-6 py-5 cursor-pointer"
                  >
                    <span className="text-sm font-semibold text-[#17181C]">{item.q}</span>
                    <span
                      className={`shrink-0 text-[#7A2D3B] text-lg leading-none transition-transform duration-200 ${
                        open ? "rotate-45" : ""
                      }`}
                    >
                      +
                    </span>
                  </button>
                  {open && (
                    <div className="px-6 pb-5 text-sm text-[#6B6D76] leading-relaxed">{item.a}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ─────────────────────────────────── */}
      <section className="section-reveal py-28 px-6 bg-[#111114] text-center relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{ backgroundImage: `radial-gradient(circle at 50% 0%, #7A2D3B 0%, transparent 60%)` }}
        />
        <div className="max-w-2xl mx-auto relative z-10">
          <h2 className="text-3xl sm:text-5xl font-bold text-white tracking-tight leading-tight mb-6">
            Start speaking with confidence.
          </h2>
          <p className="text-[#A0A0A8] text-lg mb-10">
            Be among the first to train with an AI coach that remembers your patterns and pushes you past them.
          </p>
          <button
            onClick={handleStartSession}
            className="bg-white text-[#17181C] px-10 py-4 rounded-full text-sm font-semibold cursor-pointer hover:bg-[#F0F0F0] transition-colors"
          >
            Begin Your First Session →
          </button>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────── */}
      <footer className="bg-[#111114] py-12 px-6 border-t border-white/[0.06]">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center text-[#111114] font-bold text-[10px]">
                  V
                </div>
                <span className="text-white text-sm font-semibold">VakSutra AI</span>
              </div>
              <p className="text-[#8B8C93] text-xs leading-relaxed">AI-powered coaching for the modern communicator.</p>
            </div>
            <div>
              <div className="text-[#A0A0A8] text-xs font-semibold uppercase tracking-widest mb-3">Product</div>
              <ul className="space-y-2 text-[#8B8C93] text-sm">
                <li>
                  <button onClick={() => scrollToSection("modules")} className="hover:text-white transition-colors cursor-pointer text-left">
                    Modules
                  </button>
                </li>
                <li>
                  <button onClick={() => scrollToSection("methodology")} className="hover:text-white transition-colors cursor-pointer text-left">
                    Methodology
                  </button>
                </li>
              </ul>
            </div>
            <div>
              <div className="text-[#A0A0A8] text-xs font-semibold uppercase tracking-widest mb-3">Company</div>
              <ul className="space-y-2 text-[#8B8C93] text-sm">
                <li>
                  <button onClick={() => (onNavigate ? onNavigate("about") : scrollToSection("about"))} className="hover:text-white transition-colors cursor-pointer text-left">
                    About
                  </button>
                </li>
              </ul>
            </div>
            <div>
              <div className="text-[#A0A0A8] text-xs font-semibold uppercase tracking-widest mb-3">Legal</div>
              <ul className="space-y-2 text-[#8B8C93] text-sm">
                <li>
                  <button
                    onClick={onOpenPrivacyNotice}
                    className="hover:text-white transition-colors cursor-pointer text-left"
                  >
                    Privacy &amp; Data
                  </button>
                </li>
                <li>
                  <button
                    onClick={onOpenPrivacyNotice}
                    className="hover:text-white transition-colors cursor-pointer text-left"
                  >
                    Security Commitment
                  </button>
                </li>
                <li className="text-[#5A5C63]">Terms of Service</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/[0.06] pt-6 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span className="text-[#8B8C93] text-xs">© 2025 VakSutra AI. All rights reserved.</span>
            <span className="text-[#8B8C93] text-xs">High-Precision AI Speech &amp; Delivery Coach</span>
          </div>
        </div>
      </footer>
    </div>
  );
}