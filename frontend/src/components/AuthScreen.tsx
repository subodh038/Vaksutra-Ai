"use client";

import { useState } from "react";
import { signup, login, saveTokens, signInWithGoogle } from "@/lib/auth";

interface AuthScreenProps {
  initialMode?: "login" | "signup";
  onBack: () => void;
  onSuccess: (user: { email: string; name?: string }) => void;
  onNavigate: (page: string) => void;
}

export default function AuthScreen({
  initialMode = "signup",
  onBack,
  onSuccess,
  onNavigate,
}: AuthScreenProps) {
  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // The form should start fresh for new signups/logins.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setMessage({ type: "error", text: "Please enter your email and password." });
      return;
    }
    if (mode === "signup" && !name.trim()) {
      setMessage({ type: "error", text: "Please enter your name." });
      return;
    }
    if (password.length < 6) {
      setMessage({ type: "error", text: "Password must be at least 6 characters." });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      // Marketing attribution: capture ?ref= from the landing URL so we can
      // measure which channel (reddit, whatsapp, producthunt…) each signup came from.
      let ref: string | undefined;
      if (mode === "signup" && typeof window !== "undefined") {
        try {
          const param = new URLSearchParams(window.location.search).get("ref");
          if (param && /^[a-z0-9_-]{1,64}$/i.test(param)) ref = param;
        } catch {
          /* URL parsing failure is non-fatal — proceed without attribution */
        }
      }

      const tokens = mode === "signup"
        ? await signup(email, password, name, ref)
        : await login(email, password);

      saveTokens(tokens);

      setMessage({
        type: "success",
        text: mode === "signup" ? "Account created! Welcome to VakSutra AI." : "Welcome back!",
      });

      setTimeout(() => {
        onSuccess({ email: tokens.email, name: tokens.name });
      }, 600);
    } catch (err: unknown) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Something went wrong. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-[#17181C] flex flex-col justify-between overflow-x-hidden animate-fade-in selection:bg-[#7A2D3B]/15">
      {/* ── FLOATING NAVBAR ───────────────────────────────── */}
      <div className="fixed top-4 left-0 right-0 z-50 flex justify-center px-4">
        <nav
          className="rounded-full px-6 py-2.5 flex items-center justify-between gap-6 w-full max-w-4xl border border-[#17181C]/[0.06] bg-white/80"
          style={{ backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", boxShadow: "0 8px 30px rgba(23,24,28,0.06)" }}
        >
          {/* Logo */}
          <button onClick={onBack} className="flex items-center gap-2 cursor-pointer shrink-0">
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

          {/* Center Links */}
          <div className="hidden md:flex items-center gap-1 text-sm font-medium text-[#6B6D76]">
            <button
              onClick={() => onNavigate("landing")}
              className="px-3 py-1.5 rounded-full hover:bg-[#17181C]/5 hover:text-[#17181C] transition-all cursor-pointer"
            >
              Home
            </button>
            <button
              onClick={() => onNavigate("modules")}
              className="px-3 py-1.5 rounded-full hover:bg-[#17181C]/5 hover:text-[#17181C] transition-all cursor-pointer"
            >
              Modules
            </button>
            <button
              onClick={() => onNavigate("resources")}
              className="px-3 py-1.5 rounded-full hover:bg-[#17181C]/5 hover:text-[#17181C] transition-all cursor-pointer"
            >
              Resources
            </button>
            {/*<button
              onClick={() => onNavigate("pricing")}
              className="px-3 py-1.5 rounded-full hover:bg-[#17181C]/5 hover:text-[#17181C] transition-all cursor-pointer"
            >
              Pricing
            </button>*/}
            <button
              onClick={() => onNavigate("about")}
              className="px-3 py-1.5 rounded-full hover:bg-[#17181C]/5 hover:text-[#17181C] transition-all cursor-pointer"
            >
              About
            </button>
          </div>

          {/* Close/Back */}
          <button
            onClick={onBack}
            className="text-xs text-[#6B6D76] hover:text-[#17181C] font-medium px-3.5 py-1.5 rounded-full border border-[#17181C]/10 hover:bg-[#17181C]/5 transition-all cursor-pointer"
          >
            ← Back
          </button>
        </nav>
      </div>

      {/* ── AUTH CARD ─────────────────────────────────────── */}
      <main className="flex-1 flex items-center justify-center px-4 pt-28 pb-16">
        <div
          className="max-w-md w-full bg-white rounded-3xl border border-[#17181C]/[0.08] p-8 sm:p-10 space-y-6"
          style={{ boxShadow: "0 24px 60px -24px rgba(23,24,28,0.18)" }}
        >
          {/* Header */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold text-[#17181C] tracking-tight">
              {mode === "signup" ? "Create your account" : "Welcome back"}
            </h1>
            <p className="text-xs text-[#6B6D76]">
              {mode === "signup"
                ? "Start practicing with real-time AI speech diagnostics."
                : "Log in to access your practice history and analytics."}
            </p>
          </div>

          {/* Mode Switcher Pills */}
          <div className="flex bg-[#F6F6F7] p-1 rounded-full border border-[#17181C]/[0.06]">
            <button
              type="button"
              onClick={() => {
                setMode("signup");
                setMessage(null);
                setName("");
                setEmail("");
                setPassword("");
              }}
              className={`flex-1 py-2 text-xs font-semibold rounded-full transition-all cursor-pointer ${
                mode === "signup" ? "bg-[#17181C] text-white" : "text-[#6B6D76] hover:text-[#17181C]"
              }`}
            >
              Sign Up
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setMessage(null);
                setName("");
                setEmail("");
                setPassword("");
              }}
              className={`flex-1 py-2 text-xs font-semibold rounded-full transition-all cursor-pointer ${
                mode === "login" ? "bg-[#17181C] text-white" : "text-[#6B6D76] hover:text-[#17181C]"
              }`}
            >
              Log In
            </button>
          </div>

          {/* Feedback Message */}
          {message && (
            <div
              className={`p-3 rounded-2xl text-xs flex items-center gap-2 ${
                message.type === "success"
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                  : "bg-rose-50 text-rose-800 border border-rose-200"
              }`}
            >
              <span>{message.type === "success" ? "✓" : "⚠️"}</span>
              <span>{message.text}</span>
            </div>
          )}

          {/* Social Login: Google */}
          <button
            type="button"
            onClick={() => signInWithGoogle()}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-full border border-[#17181C]/15 bg-white hover:bg-[#F6F6F7] text-xs font-semibold text-[#17181C] transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span>Continue with Google</span>
          </button>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#17181C]/10" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-[#8B8C93] font-medium text-[10px]">
                Or continue with email
              </span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#17181C]">Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Alex Morgan"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#F6F6F7] border border-[#17181C]/[0.1] rounded-xl px-4 py-2.5 text-xs sm:text-sm focus:outline-none focus:border-[#7A2D3B] transition-colors"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#17181C]">Email Address</label>
              <input
                type="email"
                required
                placeholder="name@company.com"
                autoComplete="off"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#F6F6F7] border border-[#17181C]/[0.1] rounded-xl px-4 py-2.5 text-xs sm:text-sm focus:outline-none focus:border-[#7A2D3B] transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[#17181C]">Password</label>
                {mode === "login" && (
                  <button
                    type="button"
                    onClick={() =>
                      setMessage({
                        type: "error",
                        text: "Self-serve password reset isn't available in beta yet. Email us and we'll reset it for you.",
                      })
                    }
                    className="text-[11px] text-[#7A2D3B] hover:underline cursor-pointer"
                  >
                    Forgot?
                  </button>
                )}
              </div>
              <input
                type="password"
                required
                placeholder="••••••••"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#F6F6F7] border border-[#17181C]/[0.1] rounded-xl px-4 py-2.5 text-xs sm:text-sm focus:outline-none focus:border-[#7A2D3B] transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#17181C] text-white py-3.5 rounded-full text-xs font-semibold cursor-pointer hover:bg-[#2b2c31] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              <span>{mode === "signup" ? "Create Account →" : "Sign In →"}</span>
            </button>
          </form>

          {/* Footer note */}
          <p className="text-center text-[11px] text-[#8B8C93] leading-relaxed">
            By continuing, you agree to our Terms of Service & Privacy Policy. Data stored securely in your private profile.
          </p>
        </div>
      </main>

      {/* ── FOOTER ───────────────────────────────────────── */}
      <footer className="bg-[#111114] py-6 px-6 border-t border-white/[0.06] text-center">
        <span className="text-[#8B8C93] text-xs font-mono">
          © 2025 VakSutra AI. Secure Account Portal
        </span>
      </footer>
    </div>
  );
}