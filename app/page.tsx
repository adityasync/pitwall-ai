import Link from "next/link";
import { FeaturedRaces } from "@/components/FeaturedRaces";
import { RaceReplayHero, HeroCtasLanding } from "@/components/RaceReplayHero";

const INSIDE = [
  {
    n: "01",
    tag: "TIMING",
    title: "The tower never lies",
    text: "Positions, intervals to a tenth, tyre age, DRS range and pit flags for all 20 cars on every lap.",
  },
  {
    n: "02",
    tag: "TELEMETRY",
    title: "Traces, not vibes",
    text: "Speed, throttle, brake, gear and DRS overlaid lap-on-lap through every corner — or ride onboard for one.",
  },
  {
    n: "03",
    tag: "STRATEGY",
    title: "Stop windows, modelled",
    text: "Full-field stint bars, every stop timed to a tenth, undercut threats computed at the current gap.",
  },
  {
    n: "04",
    tag: "CONTEXT",
    title: "Flags, radio, weather",
    text: "Race-control messages, team radio and track temperature pinned to the lap they happened on.",
  },
];

export default function Home() {
  return (
    <main className="relative mx-auto flex w-full max-w-[1440px] flex-col gap-20 px-4 pb-4 pt-8 sm:gap-28 sm:px-8 sm:pt-12">
      {/* giant background word */}
      <div aria-hidden className="marquee-mask pointer-events-none absolute inset-x-0 top-2 overflow-hidden">
        <div className="ticker-slow flex w-max">
          <span className="bg-word pr-16">VELOCITY — VELOCITY — VELOCITY —&nbsp;</span>
          <span className="bg-word pr-16">VELOCITY — VELOCITY — VELOCITY —&nbsp;</span>
        </div>
      </div>

      {/* Hero */}
      <section className="relative grid items-center gap-10 lg:grid-cols-[0.92fr_1.08fr] lg:gap-14">
        <div className="relative">
          <p className="blur-in tnum flex items-center gap-2.5 text-[11px] font-bold tracking-[0.24em] text-white">
            <span className="live-dot inline-block h-2 w-2 rounded-full bg-[#ff2b2b]" aria-hidden />
            RACE REPLAY <span className="text-[var(--faint)]">·</span> <span className="text-[var(--muted)]">REAL TIMING DATA</span>
            <span className="ml-2 hidden rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 tracking-[0.18em] text-[var(--muted)] sm:inline">
              MEASURED · DERIVED · ESTIMATE
            </span>
          </p>
          <h1 className="blur-in blur-in-1 display-italic mt-5 text-[clamp(3.8rem,9vw,7.5rem)] font-bold leading-[0.86] tracking-tight">
            EVERY LAP.
            <br />
            <span className="text-outline">EVERY GAP.</span>
            <br />
            <span className="bg-gradient-to-r from-[#ff2b2b] via-[#e10600] to-[#ff7a5c] bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(225,6,0,0.45)]">
              EVERY SECTOR.
            </span>
          </h1>
          <p className="blur-in blur-in-2 mt-6 max-w-lg text-lg leading-relaxed text-[var(--muted)]">
            Pitwall timing for real Grands Prix, replayable lap by lap — with
            plain calls in English or Hinglish whenever you want one.
          </p>
          <div className="blur-in blur-in-3">
            <HeroCtasLanding />
          </div>
          <div className="blur-in blur-in-4 mt-7 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-white/[0.07] pt-5">
            <p className="tnum text-[11px] tracking-[0.16em] text-[var(--faint)]">
              BRAKE IS ON/OFF · TYRE LIFE INFERRED · <span className="text-[var(--muted)]">REST MEASURED</span>
            </p>
            <Link href="/methods" className="tnum text-[11px] font-bold tracking-[0.16em] text-white/80 underline decoration-[var(--accent-deep)] decoration-2 underline-offset-4 transition hover:text-white">
              HOW WE STAY HONEST →
            </Link>
          </div>
          {/* live stat strip */}
          <dl className="blur-in blur-in-4 mt-6 grid max-w-lg grid-cols-3 overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.03] backdrop-blur-xl">
            {[
              ["20", "CARS TRACKED"],
              ["0.1s", "GAP PRECISION"],
              ["100%", "GROUNDED AI"],
            ].map(([v, l], i) => (
              <div key={l} className={`px-5 py-4 ${i > 0 ? "border-l border-white/[0.07]" : ""}`}>
                <dt className="sr-only">{l}</dt>
                <dd className="display text-2xl font-bold italic">{v}</dd>
                <dd className="tnum mt-1 text-[10px] tracking-[0.2em] text-[var(--muted)]">{l}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="blur-in blur-in-2 relative">
          {/* glow bed under console */}
          <div aria-hidden className="absolute -inset-6 rounded-[28px] bg-[radial-gradient(ellipse_at_center,rgba(225,6,0,0.16),transparent_65%)] blur-2xl" />
          <div className="relative">
            <RaceReplayHero />
          </div>
          {/* floating chips */}
          <div aria-hidden className="tnum pointer-events-none absolute -left-3 top-8 hidden rounded-full border border-white/10 bg-black/60 px-3 py-1.5 text-[10px] font-bold tracking-[0.2em] text-white backdrop-blur-xl lg:block">
            ● DRS OPEN
          </div>
          <div aria-hidden className="tnum pointer-events-none absolute -right-2 bottom-16 hidden rounded-full border border-white/10 bg-black/60 px-3 py-1.5 text-[10px] font-bold tracking-[0.2em] text-[var(--good)] backdrop-blur-xl lg:block">
            ▲ P2 → P1 · LAP 31
          </div>
        </div>
      </section>

      {/* ticker */}
      <div aria-hidden className="marquee-mask relative -mx-4 overflow-hidden border-y border-white/[0.07] bg-black/40 py-3 backdrop-blur-md sm:-mx-8">
        <div className="ticker flex w-max gap-10">
          {[0, 1].map((k) => (
            <span key={k} className="tnum flex gap-10 text-[11px] font-bold tracking-[0.24em] text-[var(--muted)]">
              <span>REAL LAP DATA <span className="text-[var(--accent)]">{"///"}</span></span>
              <span>20 CARS LIVE <span className="text-[var(--accent)]">{"///"}</span></span>
              <span>ENGLISH + HINGLISH <span className="text-[var(--accent)]">{"///"}</span></span>
              <span>NO VIBES, ONLY TRACES <span className="text-[var(--accent)]">{"///"}</span></span>
              <span>MEASURED · DERIVED · ESTIMATE <span className="text-[var(--accent)]">{"///"}</span></span>
            </span>
          ))}
        </div>
      </div>

      {/* Inside */}
      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="display-italic text-4xl font-bold tracking-tight sm:text-6xl">
            INSIDE THE <span className="text-outline">PITWALL</span>
          </h2>
          <Link href="/races" className="btn btn-secondary !min-h-[44px] px-5">
            PICK A REPLAY →
          </Link>
        </div>
        <ul className="mt-6 grid gap-3 md:grid-cols-2">
          {INSIDE.map((c) => (
            <li key={c.n} className="card card-hover group relative overflow-hidden p-6 sm:p-7">
              <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-[var(--accent-deep)]/70 via-white/20 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
              <div className="flex items-start justify-between gap-4">
                <p className="tnum text-[11px] font-bold tracking-[0.24em] text-[var(--accent)]">{c.tag}</p>
                <span className="display-italic text-5xl font-bold text-white/[0.1] transition-colors duration-500 group-hover:text-[rgba(225,6,0,0.3)]">{c.n}</span>
              </div>
              <p className="display mt-2 text-3xl font-bold leading-[0.95] tracking-tight">{c.title}</p>
              <p className="mt-3 max-w-md leading-relaxed text-[var(--muted)]">{c.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <FeaturedRaces />

      {/* Easy */}
      <section className="cut glass relative overflow-hidden px-7 py-10 sm:px-12">
        <div aria-hidden className="orb left-[10%] top-[-60px] h-56 w-56 bg-[rgba(225,6,0,0.25)]" />
        <div aria-hidden className="speed-lines absolute inset-0 opacity-40" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-10">
          <p className="display-italic shrink-0 text-4xl font-bold leading-none sm:text-5xl">
            NEW TO F1?
            <br />
            <span className="text-outline">START HERE.</span>
          </p>
          <p className="max-w-xl leading-relaxed text-[var(--muted)]">
            Easy mode calls one story at a time and explains every term as you watch. Same data as Pro — just quieter.
          </p>
          <Link href="/races" className="btn btn-primary shrink-0 sm:ml-auto">
            Start watching →
          </Link>
        </div>
      </section>
    </main>
  );
}
