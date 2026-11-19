"use client";

import { useState, useEffect } from "react";
import LandingScreen from "@/components/LandingScreen";
import TopicScreen from "@/components/TopicScreen";
import RecordingScreen from "@/components/RecordingScreen";
import ReviewScreen from "@/components/ReviewScreen";
import ResourcesScreen from "@/components/ResourcesScreen";
//import PricingScreen from "@/components/PricingScreen";
import AuthScreen from "@/components/AuthScreen";
import HistoryScreen from "@/components/HistoryScreen";
import ProfileScreen from "@/components/ProfileScreen";
import AboutScreen from "@/components/AboutScreen";
import BetaFeedbackModal from "@/components/BetaFeedbackModal";
import PrivacyNoticeModal from "@/components/PrivacyNoticeModal";
import { isLoggedIn, logout, getCurrentUser, SESSION_EXPIRED_EVENT, handleOAuthCallback } from "@/lib/auth";

export type AppScreen =
  | "landing"
  | "topic"
  | "recording"
  | "review"
  | "resources"
  | "pricing"
  | "auth"
  | "history"
  | "profile"
  | "about";

export interface RecordingResult {
  audioBlob: Blob;
  videoBlob: Blob;
  durationMs: number;
  topic: string;
}

export default function Home() {
  const [screen, setScreen] = useState<AppScreen>("landing");
  const [authMode, setAuthMode] = useState<"login" | "signup">("signup");
  const [currentTopic, setCurrentTopic] = useState<string>("");
  const [result, setResult] = useState<RecordingResult | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [pendingScrollTarget, setPendingScrollTarget] = useState<string | null>(null);
  // Where the user was trying to go when auth interrupted them — restored
  // after a successful login so intent isn't lost.
  const [postAuthTarget, setPostAuthTarget] = useState<AppScreen | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showPrivacyNotice, setShowPrivacyNotice] = useState(false);

  // Check whether user has already acknowledged the privacy notice
  useEffect(() => {
    if (typeof window !== "undefined") {
      const ack = localStorage.getItem("vaksutra_privacy_ack");
      if (!ack) {
        setShowPrivacyNotice(true);
      }
    }
  }, []);

  // This app has no real page navigations — every screen is a client-state
  // swap on one single URL/history entry. Left on its default "auto" setting,
  // the browser tries to restore whatever scroll position you had right
  // before a manual refresh, and replays it once on the next screen you
  // click into — which is the "lands scrolled down" bug. Turning this off
  // hands scroll position fully to the app instead of the browser.
  useEffect(() => {
    if (typeof window !== "undefined" && "scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
  }, []);

  // Every screen should open at its own top, regardless of where the
  // previous screen was scrolled to.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen]);

  // Check auth state on mount and on screen change
  useEffect(() => {
    setLoggedIn(isLoggedIn());
  }, [screen]);

  // Process incoming Google OAuth callback
  useEffect(() => {
    handleOAuthCallback().then((authenticated) => {
      if (authenticated) {
        setLoggedIn(true);
        setScreen("landing");
      }
    });
  }, []);

  // Soft session expiry: tokens died mid-session. Show the login screen
  // WITHOUT a page reload so any in-progress recording/report state survives.
  useEffect(() => {
    const onExpired = () => {
      setLoggedIn(false);
      setAuthMode("login");
      setScreen("auth");
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, []);

  // Warn before an accidental refresh/close while a recording or its report
  // is in play — that data only lives in this tab's memory.
  useEffect(() => {
    if (screen !== "recording" && screen !== "review") return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [screen]);

  // If user tries to go to topic/recording but isn't logged in → redirect to auth,
  // remembering where they were headed.
  const requireAuth = (next: AppScreen) => {
    if (!isLoggedIn()) {
      setAuthMode("login");
      setPostAuthTarget(next);
      setScreen("auth");
    } else {
      setScreen(next);
    }
  };

  const handleModuleSelect = (customTopic?: string) => {
    if (customTopic && customTopic.trim()) {
      setCurrentTopic(customTopic);
      requireAuth("recording");
    } else {
      requireAuth("topic");
      setCurrentTopic("");
    }
    setResult(null);
  };

  const handleTopicReady = (topic: string) => {
    setCurrentTopic(topic);
    setScreen("recording");
  };

  const handleRecordingDone = (r: RecordingResult) => {
    setResult(r);
    setScreen("review");
  };

  const handleRetry = () => {
    setResult(null);
    setScreen("topic");
  };

  const handleBackToModules = () => {
    setResult(null);
    setCurrentTopic("");
    setScreen("landing");
  };

  const handleNavigate = (page: string, mode?: "login" | "signup") => {
    if (mode) setAuthMode(mode);
    // "Modules" isn't its own screen — it's a section on Landing. From any
    // other screen, take the user to Landing and carry the scroll target
    // along so Landing can scroll to it once mounted.
    if (page === "modules") {
      setPendingScrollTarget("modules");
      setScreen("landing");
      return;
    }
    // Guard history/profile to require auth
    if ((page === "history" || page === "profile") && !isLoggedIn()) {
      setAuthMode("login");
      setPostAuthTarget(page as AppScreen);
      setScreen("auth");
    } else {
      setScreen(page as AppScreen);
    }
  };

  const handleAuthSuccess = (_user: { email: string; name?: string }) => {
    setLoggedIn(true);
    // Resume whatever the user was trying to do before auth interrupted them.
    const target = postAuthTarget;
    setPostAuthTarget(null);
    setScreen(target ?? "landing");
  };

  const handleLogout = () => {
    logout();
    setLoggedIn(false);
    setScreen("landing");
  };

  return (
    <main className="min-h-screen bg-black text-[#17181C] relative selection:bg-[#7A2D3B]/20 selection:text-[#17181C]">
      {screen === "landing" && (
        <LandingScreen
          onSelectImpromptu={handleModuleSelect}
          onNavigate={handleNavigate}
          loggedIn={loggedIn}
          userEmail={getCurrentUser()?.email}
          onLogout={handleLogout}
          scrollTarget={pendingScrollTarget}
          onScrollTargetHandled={() => setPendingScrollTarget(null)}
          onOpenPrivacyNotice={() => setShowPrivacyNotice(true)}
        />
      )}
      {screen === "resources" && (
        <ResourcesScreen
          onBack={handleBackToModules}
          onNavigate={handleNavigate}
          onSelectTopic={(topic) => handleModuleSelect(topic)}
          loggedIn={loggedIn}
          userEmail={getCurrentUser()?.email}
          onLogout={handleLogout}
        />
      )}
     {/* {screen === "pricing" && (
        <PricingScreen
          onBack={handleBackToModules}
          onNavigate={handleNavigate}
          onSelectPlan={() => handleNavigate("auth", "signup")}
          loggedIn={loggedIn}
          userEmail={getCurrentUser()?.email}
          onLogout={handleLogout}
        />
     )}*/}
      {screen === "auth" && (
        <AuthScreen
          initialMode={authMode}
          onBack={handleBackToModules}
          onNavigate={handleNavigate}
          onSuccess={handleAuthSuccess}
        />
      )}
      {screen === "history" && (
        <HistoryScreen
          onBack={handleBackToModules}
          onNavigate={handleNavigate}
          loggedIn={loggedIn}
          userEmail={getCurrentUser()?.email}
          onLogout={handleLogout}
        />
      )}
      {screen === "profile" && (
        <ProfileScreen
          onBack={handleBackToModules}
          onNavigate={handleNavigate}
          loggedIn={loggedIn}
          userEmail={getCurrentUser()?.email}
          onLogout={handleLogout}
        />
      )}
      {screen === "about" && (
        <AboutScreen
          onBack={handleBackToModules}
          onNavigate={handleNavigate}
          loggedIn={loggedIn}
          userEmail={getCurrentUser()?.email}
          onLogout={handleLogout}
        />
      )}
      {screen === "topic" && (
        <TopicScreen onStart={handleTopicReady} onBack={handleBackToModules} />
      )}
      {screen === "recording" && (
        <RecordingScreen
          topic={currentTopic}
          onDone={handleRecordingDone}
          onBack={handleBackToModules}
        />
      )}
      {screen === "review" && result && (
        <ReviewScreen
          result={result}
          onRetry={handleRetry}
          onBack={handleBackToModules}
        />
      )}

      {/* Floating Privacy Notice button */}
      {!showPrivacyNotice && (
        <button
          onClick={() => setShowPrivacyNotice(true)}
          aria-label="View privacy and security policy"
          className="fixed bottom-6 left-6 z-40 px-4 py-3 text-xs font-semibold rounded-full bg-[#131117]/90 hover:bg-[#1C1A22] text-[#D1D2D6] hover:text-white border border-white/15 shadow-2xl backdrop-blur-md hover:border-[#7A2D3B]/40 hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center gap-2 animate-fade-in"
        >
          <span className="text-sm">🛡️</span>
          <span>Privacy &amp; Security</span>
        </button>
      )}

      {/* Beta feedback — floating button on every screen when logged in */}
      {loggedIn && !showFeedback && (
        <button
          onClick={() => setShowFeedback(true)}
          aria-label="Give beta feedback"
          className="fixed bottom-6 right-6 z-40 px-5 py-3 text-sm font-bold rounded-full bg-[#7A2D3B] text-white shadow-2xl hover:bg-[#8F3545] hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center gap-2 border border-white/20 animate-fade-in"
        >
          <span className="text-base">💬</span>
          <span>Beta Review</span>
        </button>
      )}
      {showFeedback && (
        <BetaFeedbackModal onClose={() => setShowFeedback(false)} />
      )}

      {showPrivacyNotice && (
        <PrivacyNoticeModal
          isOpen={showPrivacyNotice}
          onClose={() => {
            localStorage.setItem("vaksutra_privacy_ack", "true");
            setShowPrivacyNotice(false);
          }}
          onOpenFeedback={() => {
            setShowPrivacyNotice(false);
            setShowFeedback(true);
          }}
        />
      )}
    </main>
  );
}