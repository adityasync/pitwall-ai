import type { Metadata } from "next";
import { Barlow, Barlow_Condensed, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { TopBar } from "@/components/TopBar";
import { PlaybackKeys } from "@/components/PlaybackKeys";
import { CommandPalette } from "@/components/CommandPalette";

const display = Barlow_Condensed({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700"],
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
      className={`${display.variable} ${body.variable} ${data.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[var(--bg)] text-[var(--text)]">
        <a href="#content" className="skip-link">
          Skip to content
        </a>
        <PlaybackKeys />
        <CommandPalette />
        <TopBar />
        <div id="content" className="flex flex-1 flex-col">{children}</div>
        <footer className="border-t border-[var(--border)] px-4 py-3 text-xs text-[var(--muted)]">
          <span>Unofficial fan project. Data: OpenF1 + FastF1. Not affiliated with
          Formula 1, the FIA or any team.</span>
          <span className="ml-4 inline-flex gap-3">
            <a href="/methods" className="underline">Methods + data limits</a>
            <a href="/races" className="underline">Races</a>
            <a href="/ask" className="underline">Ask the AI</a>
          </span>
        </footer>
      </body>
    </html>
  );
}
