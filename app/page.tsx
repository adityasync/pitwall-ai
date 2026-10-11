import Link from "next/link";
import { FeaturedRaces } from "@/components/FeaturedRaces";
import { HeroCard, HeroCtas } from "@/components/HeroCard";

const PROBLEMS = [
  {
    tag: "TOO FAST",
    title: "The broadcast never slows down",
    text: "A gap shrinks, a car pits, the lead changes — and the coverage has already moved on.",
  },
  {
    tag: "TOO JARGONY",
    title: "Commentary assumes years of context",
    text: "Undercut, delta, deg, out-lap. New fans hear words; nobody explains them in a line.",
  },
  {
    tag: "ENGLISH ONLY",
    title: "Half the conversation is missing",
    text: "Millions of Indian fans talk F1 in Hinglish. Coverage rarely meets them there.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Pick a replay",
    text: "Real races, free historical data. Scrub to any lap — the whole race is loaded.",
  },
  {
    n: "02",
    title: "Tap a moment",
    text: "Overtakes, pit stops, gap swings, flags. Each one carries its numbers with it.",
  },
  {
    n: "03",
    title: "Understand why",
    text: "A plain explanation in English or Hinglish, with an evidence strip showing every number used.",
  },
];

const MODES = [
  {
    tag: "NEW TO F1",
    name: "Easy mode",
    text: "One clear story at a time. Big gaps, simple tyre health, and every term explained in a line.",
    href: "/races",
    cta: "Start watching",
  },
  {
    tag: "FOR THE DEVOTED",
    name: "Pro mode",
    text: "The full workstation: telemetry traces, braking zones, strategy simulator, tyre pace and radio.",
    href: "/races",
    cta: "Open the pit wall",
  },
];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-[1360px] flex-col gap-16 px-4 py-10 sm:gap-20 sm:py-14">
      {/* Hero */}
      <section className="grid items-center gap-8 lg:grid-cols-2">
        <div>
          <p className="panel-label">Your second screen for Formula 1</p>
          <h1 className="display mt-3 text-6xl font-bold leading-[0.95] tracking-tight sm:text-7xl">
            Watch the race.
            <br />
            <span className="text-[var(--accent)]">Understand</span> the race.
          </h1>
          <p className="mt-4 max-w-xl text-lg text-[var(--muted)]">
            Tap any overtake, pit stop or gap change and get a plain explanation
            backed by real lap data, in English or Hinglish.
          </p>
          <HeroCtas />
        </div>

        <HeroCard />
      </section>

      <FeaturedRaces />

      {/* Problem */}
      <section>
        <p className="panel-label">The problem</p>
        <h2 className="display mt-2 text-4xl font-bold sm:text-5xl">
          F1 moves fast. Understanding it takes years.
        </h2>
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {PROBLEMS.map((p) => (
            <div key={p.tag} className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-5">
              <p className="panel-label">{p.tag}</p>
              <p className="mt-2 text-lg font-semibold">{p.title}</p>
              <p className="mt-1 text-[var(--muted)]">{p.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section>
        <p className="panel-label">How it works</p>
        <h2 className="display mt-2 text-4xl font-bold sm:text-5xl">
          Tap a moment. Understand why.
        </h2>
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-5">
              <p className="tnum text-sm font-bold text-[var(--accent)]">{s.n}</p>
              <p className="mt-2 text-lg font-semibold">{s.title}</p>
              <p className="mt-1 text-[var(--muted)]">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Modes */}
      <section>
        <p className="panel-label">Two ways to watch</p>
        <h2 className="display mt-2 text-4xl font-bold sm:text-5xl">
          Start simple. Go as deep as you like.
        </h2>        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {MODES.map((m) => (
            <div key={m.name} className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-6">
              <p className="panel-label">{m.tag}</p>
              <p className="display mt-2 text-3xl font-bold">{m.name}</p>
              <p className="mt-2 text-[var(--muted)]">{m.text}</p>
              <Link
                href={m.href}
                className="touch mt-4 inline-flex items-center rounded-md bg-[var(--accent)] px-5 font-semibold text-black"
              >
                {m.cta} →
              </Link>
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <Link href="/races" className="touch inline-flex items-center text-[var(--accent)]">
            Choose a race →
          </Link>
          <Link href="/ask" className="touch inline-flex items-center text-[var(--accent)]">
            Ask the AI →
          </Link>
        </div>
      </section>
    </main>
  );
}
