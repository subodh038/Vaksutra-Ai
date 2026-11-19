"use client";

import { useState } from "react";
import AccountMenu from "./AccountMenu";

interface PricingScreenProps {
  onBack: () => void;
  onSelectPlan: (plan: string) => void;
  onNavigate: (page: string) => void;
  loggedIn?: boolean;
  userEmail?: string;
  onLogout?: () => void;
}

const PRICING_PLANS = [
  {
    id: "free",
    name: "Starter Drill",
    subtitle: "For individuals building daily speaking consistency.",
    priceMonthly: "$0",
    priceAnnual: "$0",
    period: "forever free",
    badge: null,
    highlight: false,
    cta: "Start Free Practice",
    features: [
      "Up to 5 impromptu drills per day",
      "Real-time gaze & eye contact tracking",
      "Basic WPM speech pacing diagnostics",
      "Filler word counter (um, uh, like)",
      "Standard audio-video replay",
    ],
  },
  {
    id: "pro",
    name: "Executive Pro",
    subtitle: "For founders, managers, and high-stakes presenters.",
    priceMonthly: "$29",
    priceAnnual: "$24",
    period: "per month",
    badge: "MOST POPULAR",
    highlight: true,
    cta: "Start 14-Day Free Trial",
    features: [
      "Unlimited impromptu & presentation drills",
      "Full MediaPipe 468-point tension analytics",
      "Pitch variation & vocal warmth diagnostics",
      "AI Interrupter & Q&A Simulator access",
      "Detailed timestamped speech transcripts",
      "Personalized weekly progress trajectory",
      "On-device zero-latency processing",
    ],
  },
  {
    id: "team",
    name: "Enterprise & Teams",
    subtitle: "For corporate leadership cohorts and coaching organizations.",
    priceMonthly: "$79",
    priceAnnual: "$65",
    period: "per seat / month",
    badge: "TEAMS",
    highlight: false,
    cta: "Contact Enterprise Sales",
    features: [
      "Everything in Executive Pro",
      "Centralized team analytics dashboard",
      "Custom speech prompt templates",
      "Integration with Zoom & Microsoft Teams",
      "Dedicated account manager & SLA",
      "SSO & SOC-2 compliance data room",
    ],
  },
];

const FAQS = [
  {
    q: "How does the AI analyze my delivery?",
    a: "VakSutra AI runs lightweight computer vision (MediaPipe) and speech transcription models directly in your browser or private cloud, analyzing facial landmarks, vocal acoustic pitch, and speaking pacing in real time.",
  },
  {
    q: "Is my camera and microphone data stored privately?",
    a: "Yes. All video frame diagnostics and biometric landmark calculations run strictly on-device in browser memory. Video feeds are never stored permanently without your explicit consent.",
  },
  {
    q: "Can I cancel or switch plans anytime?",
    a: "Absolutely. You can upgrade, downgrade, or cancel your subscription at any time with a single click from your account console.",
  },
  {
    q: "Do you offer discounts for educational institutions or students?",
    a: "Yes! We offer a 50% discount for verified students, educators, and non-profit organizations. Reach out to our support team for verification.",
  },
];

export default function PricingScreen({ onBack, onSelectPlan, onNavigate, loggedIn, userEmail, onLogout }: PricingScreenProps) {
  const [annualBilling, setAnnualBilling] = useState(true);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div className="min-h-screen bg-[#FFFFFF] text-[#17181C] flex flex-col justify-between overflow-x-hidden animate-fade-in selection:bg-[#7A2D3B]/20">
      {/* ── FLOATING NAVBAR ───────────────────────────────── */}
      <div className="fixed top-4 left-0 right-0 z-50 flex justify-center px-4">
        <nav
          className="rounded-full px-6 py-2.5 flex items-center justify-between gap-6 w-full max-w-4xl border border-[#17181C]/[0.06] bg-white/80"
          style={{ backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", boxShadow: "0 8px 30px rgba(23,24,28,0.06)" }}
        >
          {/* Logo */}
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

          {/* Center Links */}
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
            <button
              onClick={() => onNavigate("pricing")}
              className="px-3 py-1.5 rounded-full bg-[#17181C] text-white transition-all cursor-pointer"
            >
              Pricing
            </button>
            <button
              onClick={() => onNavigate("about")}
              className="px-3 py-1.5 rounded-full hover:bg-[#17181C]/8 hover:text-[#17181C] transition-all cursor-pointer"
            >
              About
            </button>
          </div>

          {/* Right Auth */}
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

      {/* ── HEADER ───────────────────────────────────────── */}
      <main className="max-w-6xl w-full mx-auto px-6 pt-32 pb-20">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <p className="text-[#7A2D3B] text-xs font-semibold uppercase tracking-[0.2em] mb-3">
            Transparent Investment
          </p>
          <h1 className="text-4xl sm:text-6xl font-bold text-[#17181C] leading-tight mb-5">
            Invest in your <span className="italic text-[#7A2D3B]">voice</span>.
          </h1>
          <p className="text-[#6B6D76] text-base leading-relaxed">
            Every plan gives you the same honest feedback. The difference is how often you get to use it.
          </p>

          {/* Billing Switch */}
          <div className="mt-8 inline-flex items-center gap-3 bg-white p-1.5 rounded-full border border-[#17181C]/10 shadow-xs">
            <button
              onClick={() => setAnnualBilling(false)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                !annualBilling ? "bg-[#17181C] text-white" : "text-[#6B6D76] hover:text-[#17181C]"
              }`}
            >
              Monthly Billing
            </button>
            <button
              onClick={() => setAnnualBilling(true)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                annualBilling ? "bg-[#17181C] text-white" : "text-[#6B6D76] hover:text-[#17181C]"
              }`}
            >
              <span>Annual Billing</span>
              <span className="text-[10px] bg-[#7A2D3B] text-white px-1.5 py-0.2 rounded-full font-mono">
                SAVE 20%
              </span>
            </button>
          </div>
        </div>

        {/* ── PRICING CARDS ─────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch mb-24">
          {PRICING_PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`rounded-3xl p-8 flex flex-col justify-between transition-all duration-300 relative ${
                plan.highlight
                  ? "bg-[#17181C] text-white shadow-2xl scale-[1.02] border border-[#7A2D3B]/40"
                  : "bg-white text-[#17181C] border border-[#17181C]/8 shadow-sm hover:shadow-md"
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#7A2D3B] text-white font-mono text-[10px] font-bold px-3 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
                  {plan.badge}
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-2xl font-bold">{plan.name}</h3>
                </div>
                <p className={`text-xs leading-relaxed mb-6 ${plan.highlight ? "text-[#8B8C93]" : "text-[#6B6D76]"}`}>
                  {plan.subtitle}
                </p>

                {/* Price Display */}
                <div className="mb-6 pb-6 border-b border-white/10">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl sm:text-5xl font-bold tracking-tight">
                      {annualBilling ? plan.priceAnnual : plan.priceMonthly}
                    </span>
                    <span className={`text-xs font-mono ${plan.highlight ? "text-[#8B8C93]" : "text-[#6B6D76]"}`}>
                      / {plan.period}
                    </span>
                  </div>
                  {annualBilling && plan.id !== "free" && (
                    <div className="text-[11px] text-[#7A2D3B] font-mono mt-1 font-medium">
                      Billed annually (save 20%)
                    </div>
                  )}
                </div>

                {/* Features List */}
                <div className="space-y-3 mb-8">
                  <span className={`text-[10px] font-mono uppercase tracking-widest block font-bold ${
                    plan.highlight ? "text-[#7A2D3B]" : "text-[#8B8C93]"
                  }`}>
                    What&apos;s included:
                  </span>
                  {plan.features.map((feat, i) => (
                    <div key={i} className="flex items-start gap-2.5 text-xs">
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                        plan.highlight ? "bg-[#7A2D3B]/20 text-[#7A2D3B]" : "bg-[#7A2D3B]/15 text-[#7A2D3B]"
                      }`}>
                        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      </div>
                      <span className={plan.highlight ? "text-[#A0A0A8]" : "text-[#6B6D76]"}>
                        {feat}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Button */}
              <button
                onClick={() => onSelectPlan(plan.id)}
                className={`w-full py-3.5 rounded-full text-xs font-semibold transition-all cursor-pointer shadow-sm ${
                  plan.highlight
                    ? "bg-[#17181C] hover:bg-[#2b2c31] transition-colors text-white text-white"
                    : "bg-[#17181C] text-white hover:bg-[#2b2c31]"
                }`}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>

        {/* ── FAQ SECTION ─────────────────────────────────── */}
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-[#17181C]">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="space-y-3">
            {FAQS.map((faq, idx) => (
              <div
                key={idx}
                className="bg-white rounded-2xl border border-[#17181C]/8 p-5 cursor-pointer shadow-xs transition-all"
                onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
              >
                <div className="flex items-center justify-between">
                  <span className="text-base font-bold text-[#17181C]">{faq.q}</span>
                  <span className="text-sm text-[#7A2D3B] font-bold font-mono">
                    {openFaq === idx ? "−" : "+"}
                  </span>
                </div>
                {openFaq === idx && (
                  <p className="text-xs sm:text-sm text-[#6B6D76] leading-relaxed mt-3 pt-3 border-t border-[#17181C]/5">
                    {faq.a}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* ── FOOTER ───────────────────────────────────────── */}
      <footer className="bg-[#111114] py-8 px-6 border-t border-white/5 text-center">
        <span className="text-[#6B6D76] text-xs font-mono">
          © 2025 VakSutra AI. All rights reserved. • Enterprise-Grade Communication Intelligence
        </span>
      </footer>
    </div>
  );
}