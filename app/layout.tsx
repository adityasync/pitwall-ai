import type { Metadata } from "next";
import { Anton, Barlow, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { TopBar } from "@/components/TopBar";
import { PlaybackKeys } from "@/components/PlaybackKeys";
import { CommandPalette } from "@/components/CommandPalette";

const display = Anton({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400"],
});

const body = Barlow({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const data = JetBrains_Mono({
  variable: "--font-data",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "PITWALL.AI — Watch the race. Understand the race.",
  description:
    "A second-screen companion for Formula 1. Tap any overtake, pit stop or gap change and get a plain explanation backed by real lap data, in English or Hinglish.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${display.variable} ${body.variable} ${data.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[var(--bg)] text-[var(--text)]">
        <div aria-hidden="true" className="atmosphere" />
        <a href="#content" className="skip-link">
          Skip to content
        </a>
        <PlaybackKeys />
        <CommandPalette />
        <TopBar />
        <div id="content" className="relative z-10 flex flex-1 flex-col">{children}</div>
        <footer className="relative z-10 mt-20 border-t border-white/[0.07] bg-black/50 backdrop-blur-2xl">
          <div aria-hidden className="h-px bg-gradient-to-r from-transparent via-[var(--accent-deep)]/60 to-transparent" />
          <div className="mx-auto flex w-full max-w-[1440px] flex-wrap items-center gap-x-8 gap-y-3 px-4 py-8 text-sm text-[var(--muted)] sm:px-8">
            <p className="display text-lg font-bold italic tracking-tight text-[var(--text)]">
              pitwall<span className="text-[var(--accent)]">.ai</span>
            </p>
            <p className="max-w-md text-xs leading-relaxed">
              Unofficial fan project. Data: OpenF1 + FastF1. Not affiliated with
              Formula 1, the FIA or any team.
            </p>
            <span className="tnum ml-auto inline-flex gap-5 text-[11px] font-bold tracking-[0.18em]">
              <a href="/methods" className="transition hover:text-white">METHODS</a>
              <a href="/races" className="transition hover:text-white">RACES</a>
              <a href="/ask" className="transition hover:text-white">ASK AI</a>
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
