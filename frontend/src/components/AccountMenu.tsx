"use client";

import { useEffect, useRef, useState } from "react";

interface AccountMenuProps {
  userEmail?: string;
  onNavigate?: (page: string, mode?: "login" | "signup") => void;
  onLogout?: () => void;
}

export default function AccountMenu({ userEmail, onNavigate, onLogout }: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on click-outside or Escape — standard dropdown behavior.
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, []);

  const initial = userEmail ? userEmail.trim().charAt(0).toUpperCase() : "U";

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-9 h-9 rounded-full bg-[#7A2D3B] text-white flex items-center justify-center text-sm font-bold cursor-pointer hover:bg-[#8a3444] transition-colors shrink-0"
        aria-label="Account menu"
        aria-expanded={open}
      >
        {initial}
      </button>

      {open && (
        <div
          className="absolute right-0 top-[calc(100%+10px)] w-56 bg-white rounded-2xl border border-[#17181C]/[0.08] py-1.5 z-50"
          style={{ boxShadow: "0 16px 40px -12px rgba(23,24,28,0.2)" }}
        >
          {userEmail && (
            <div className="px-4 py-3 border-b border-[#17181C]/[0.06] mb-1">
              <p className="text-[10px] font-mono uppercase text-[#8B8C93] tracking-wider mb-0.5">Signed in as</p>
              <p className="text-xs font-semibold text-[#17181C] truncate">{userEmail}</p>
            </div>
          )}

          <button
            onClick={() => {
              setOpen(false);
              onNavigate?.("profile");
            }}
            className="w-full text-left px-4 py-2.5 text-sm text-[#17181C] hover:bg-[#17181C]/5 transition-colors cursor-pointer flex items-center gap-2.5"
          >
            <svg className="w-4 h-4 text-[#6B6D76]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
            Profile
          </button>

          <button
            onClick={() => {
              setOpen(false);
              onNavigate?.("history");
            }}
            className="w-full text-left px-4 py-2.5 text-sm text-[#17181C] hover:bg-[#17181C]/5 transition-colors cursor-pointer flex items-center gap-2.5"
          >
            <svg className="w-4 h-4 text-[#6B6D76]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Session history
          </button>

          <div className="my-1.5 border-t border-[#17181C]/[0.06]" />

          <button
            onClick={() => {
              setOpen(false);
              onLogout?.();
            }}
            className="w-full text-left px-4 py-2.5 text-sm text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer flex items-center gap-2.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
            </svg>
            Log out
          </button>
        </div>
      )}
    </div>
  );
}