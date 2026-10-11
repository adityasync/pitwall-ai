"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useUiStore } from "@/stores/uiStore";
import { ASK_MAX_CHARS } from "@/lib/config";
import { loadJson } from "@/lib/data";
import { AiCard } from "@/components/AiCard";
import { StateCard } from "@/components/StateCard";
import type { Evidence } from "@/lib/types";

type Msg = {
  q: string;
  headline: string;
  text: string;
  evidence: Evidence[];
  fallback?: boolean;
};

const SUGGESTED = [
  { en: "Why did the leader pit when he did?", hi: "Leader ne us lap par pit kyun kiya?" },
  { en: "Can the chaser pass before the end?", hi: "Kya wo Verstappen ko pass kar payega?" },
  { en: "Whose tyres are in better shape?", hi: "Kiske tyres behtar haalat mein hain?" },
];

function AskPage() {
  const search = useSearchParams();
  const [raceId, setRaceId] = useState<string | null>(search.get("race"));
  const { lang } = useUiStore();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState(search.get("q") ?? "");
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coverage, setCoverage] = useState<[string, boolean][]>([]);

  useEffect(() => {
    let live = true;
    (async () => {
      if (raceId) return;
      const { firstRaceId } = await import("@/lib/first-race");
      const id = await firstRaceId();
      if (live && id) setRaceId(id);
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!raceId) return;
    let live = true;
    (async () => {
      const m = await loadJson<{ coverage: Record<string, boolean> }>(`${raceId}/meta.json`);
      if (!live || m.status !== "ready" || !m.data) return;
      setCoverage([
        ["Lap times + sectors", true],
        ["Gaps + positions", true],
        ["Pit stops + stints", true],
        ["Overtakes", true],
        ["Flags + race control", true],
        ["Weather", !!m.data.coverage.weather],
        ["Team radio", !!m.data.coverage.radio],
        ["Telemetry traces", !!m.data.coverage.telemetry],
        ["Brake pressure", false],
        ["Tyre temperature", false],
        ["ERS / steering", false],
      ]);
    })();
    return () => {
      live = false;
    };
  }, [raceId]);

  useEffect(() => {
    const q = search.get("q");
    if (q) void send(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function send(question: string) {
    const qq = question.slice(0, ASK_MAX_CHARS).trim();
    if (!qq || thinking || !raceId) return;
    setThinking(true);
    setError(null);
    try {
      const r = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: qq, raceId, lang }),
      });
      const d = await r.json();
      if (!r.ok) {
        setError(d.error ?? "Something went wrong.");
      } else {
        setMsgs((m) => [...m, { q: qq, headline: d.headline, text: d.text, evidence: d.evidence ?? [], fallback: d.fallback }]);
      }
    } catch {
      setError("The AI is unreachable right now. The replay still works.");
    } finally {
      setThinking(false);
      setInput("");
    }
  }

  if (!raceId) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 sm:px-6 py-10">
        <StateCard kind="loading" title="Finding a replay" text="Loading the race list…" progress={50} />
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 pb-10 pt-6">
      <div className="flex items-center gap-3">
        <Link href={`/race/${raceId}/easy`} className="touch inline-flex items-center text-sm text-[var(--accent)]">
          ← Back to race
        </Link>
        <span className="tnum ml-auto rounded border border-[var(--border-strong)] px-2 py-1 text-[11px] text-[var(--accent)]">
          REPLAY · {raceId}
        </span>
      </div>
      <h1 className="display text-4xl font-bold">Ask the AI</h1>

      {msgs.length === 0 && !thinking && (
        <div className="flex flex-wrap gap-2">
          {SUGGESTED.map((s) => (
            <button key={s.en} onClick={() => void send(lang === "hi" ? s.hi : s.en)}
              className="touch rounded-full border border-[var(--border-strong)] px-4 text-sm">
              {lang === "hi" ? s.hi : s.en}
            </button>
          ))}
        </div>
      )}

      {msgs.map((m, i) => (
        <div key={i} className="flex flex-col gap-2">
          <p className="self-end rounded-md bg-[var(--raised)] px-4 py-2.5 text-sm">{m.q}</p>
          <AiCard headline={m.headline || "Pit wall AI"} text={m.text} hinglish={m.text}
            evidence={m.evidence}
            footer="Brake is an on/off signal, so braking distances are approximate."
            lang={lang} />
          <div className="flex gap-4 text-sm">
            <Link className="text-[var(--accent)] underline" href={`/race/${raceId}/compare`}>Open the speed traces</Link>
            <Link className="text-[var(--accent)] underline" href={`/race/${raceId}/pro`}>Show on the map</Link>
          </div>
        </div>
      ))}

      {thinking && (
        <StateCard kind="thinking" title="Checking the race data…" text="Checking gap trend and tyre age…" />
      )}
      {error && <StateCard kind="error" title="Could not answer" text={error} />}

      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void send(input); }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value.slice(0, ASK_MAX_CHARS))}
          placeholder={lang === "hi" ? "Is race ke baare mein poochho" : "Ask about this race"}
          aria-label="Ask about this race"
          className="touch min-w-0 flex-1 rounded-md border border-[var(--border-strong)] bg-[var(--raised)] px-4 text-sm"
        />
        <button type="submit" disabled={thinking}
          className="touch rounded-md bg-[var(--accent-deep)] px-5 text-sm font-bold text-white disabled:opacity-50">
          Ask
        </button>
      </form>

      <section aria-label="What the AI can see" className="card p-4">
        <p className="panel-label mb-2">What the AI can see</p>
        <ul className="tnum grid gap-1 text-xs sm:grid-cols-2">
          {coverage.map(([name, ok]) => (
            <li key={name} className="flex items-center gap-2">
              <span style={{ color: ok ? "var(--good)" : "var(--bad)" }}>{ok ? "READY" : "NOT AVAILABLE"}</span>
              <span className="text-[var(--muted)]">{name}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-[var(--muted)]">
          Answers only use the race data above. If the data cannot answer a question, the AI says so instead of guessing.
        </p>
      </section>
    </main>
  );
}

export default function AskRoute() {
  return (
    <Suspense fallback={<main className="mx-auto w-full max-w-3xl px-4 sm:px-6 py-10"><p className="text-[var(--muted)]">Loading…</p></main>}>
      <AskPage />
    </Suspense>
  );
}
