import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VakSutra AI — Free AI Speaking Coach | Impromptu Practice",
  description:
    "Mind goes blank when you're put on the spot? Practice impromptu speaking with a free AI coach: speak 2 min on camera, get scored on eye contact, filler words, pace & confidence. Video never leaves your browser.",
  keywords: [
    "impromptu speaking practice",
    "AI speaking coach",
    "public speaking practice online",
    "interview practice AI",
    "filler words tracker",
    "eye contact practice",
    "free speaking coach",
    "speaking anxiety practice",
    "table topics practice",
  ],
  openGraph: {
    title: "VakSutra AI — Your Personal AI Speaking Coach",
    description:
      "Speak 2 minutes on camera. Get an honest score on eye contact, filler words, pacing, and confidence — free, in your browser.",
    type: "website",
    siteName: "VakSutra AI",
  },
  twitter: {
    card: "summary_large_image",
    title: "VakSutra AI — Your Personal AI Speaking Coach",
    description:
      "Speak 2 minutes on camera. Get an honest score on eye contact, filler words, pacing, and confidence — free, in your browser.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-black">{children}</body>
    </html>
  );
}
