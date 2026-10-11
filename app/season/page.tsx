"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { loadH2H, loadSeasons, loadTitle, type H2HRow, type SeasonYear, type TitleYear } from "@/lib/history";
import { StateCard } from "@/components/StateCard";

/** Season explorer — 77 years of real history (Ergast mirror, data/*.csv).
 *  Champions + every race winner per year. Replays link through when built. */
export default function SeasonPage() {
  const [years, setYears] = useState<SeasonYear[] | null>(null);
  const [titles, setTitles] = useState<TitleYear[] | null>(null);
  const [h2h, setH2h] = useState<H2HRow[] | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [year, setYear] = useState<number>(2025);

  useEffect(() => {
    let live = true;
    (async () => {
      const [s, t, h] = await Promise.all([loadSeasons(), loadTitle(), loadH2H()]);
      if (!live) return;
      if (s.status !== "ready" || !s.data || s.data.length === 0) {
        setStatus(s.status === "ready" ? "empty" : "error");
        return;
      }
      setYears(s.data);
      setYear(s.data[s.data.length - 1].year);
      if (t.status === "ready" && t.data) setTitles(t.data);
      if (h.status === "ready" && h.data) setH2h(h.data);
      setStatus("ready");
    })();
    return () => {
      live = false;
    };
  }, []);

  const sel = useMemo(() => years?.find((y) => y.year === year) ?? null, [years, year]);
  const title = useMemo(() => titles?.find((t) => t.year === year) ?? null, [titles, year]);
  const duels = useMemo(() => h2h?.filter((r) => r.year === year) ?? [], [h2h, year]);

  if (status === "loading") {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 sm:px-6 py-10">
        <StateCard kind="loading" title="Loading 77 seasons" text="Reading history…" progress={60} />
      </main>
    );
  }
  if (status !== "ready" || !years || !sel) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 sm:px-6 py-10">
        <StateCard kind="error" title="No history data" text="Run python pipeline/build_history.py first." />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 sm:px-6 pb-12 pt-5">
      <p className="panel-label">Season explorer · 1950–{years[years.length - 1].year} · Ergast mirror</p>
      <h1 className="display mt-1 text-4xl font-bold">Every season, every winner</h1>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <label htmlFor="season-year" className="panel-label">Season</label>
        <select
          id="season-year"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="touch rounded-lg border border-[var(--border-strong)] bg-[var(--panel)] px-3 text-sm font-bold"
        >
          {[...years].reverse().map((y) => (
            <option key={y.year} value={y.year}>{y.year}</option>
          ))}
        </select>
        <span className="tnum text-xs text-[var(--muted)]">{sel.races.length} rounds</span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="card p-5">
          <p className="panel-label">Drivers&apos; champion</p>
          <p className="display mt-1 text-2xl font-bold">{sel.champDriver?.driver ?? "—"}</p>
          {sel.champDriver && (
            <p className="tnum mt-1 text-sm text-[var(--muted)]">
              {sel.champDriver.points} pts · {sel.champDriver.wins} wins
            </p>
          )}
        </div>
        <div className="card p-5">
          <p className="panel-label">Constructors&apos; champion</p>
          <p className="display mt-1 text-2xl font-bold">{sel.champTeam?.team ?? "—"}</p>
          {sel.champTeam && (
            <p className="tnum mt-1 text-sm text-[var(--muted)]">
              {sel.champTeam.points} pts · {sel.champTeam.wins} wins
            </p>
          )}
        </div>
      </div>

      <section aria-label={`${year} race winners`} className="mt-6">
        <div className="overflow-x-auto rounded-md border border-[var(--border)]">
          <table className="tnum w-full min-w-[760px] text-sm">
            <thead>
              <tr className="panel-label border-b border-[var(--border)] text-left">
                <th className="p-2">RD</th><th className="p-2">Grand Prix</th>
                <th className="p-2">Winner</th><th className="p-2">Pole</th>
                <th className="p-2">Fastest</th><th className="p-2">RET</th><th className="p-2">Pits</th>
              </tr>
            </thead>
            <tbody>
              {sel.races.map((r) => (
                <tr key={`${r.year}-${r.round}`} className="border-b border-[var(--border)] last:border-0">
                  <td className="p-2 text-[var(--muted)]">{r.round}</td>
                  <td className="p-2 font-semibold">{r.name}{r.sprintWinner ? <span className="ml-1 text-xs text-[var(--muted)]">SPR {r.sprintWinnerCode}</span> : null}</td>
                  <td className="p-2 font-bold">{r.winnerCode ?? "—"}</td>
                  <td className="p-2 text-[var(--muted)]">{r.poleCode ?? "—"}</td>
                  <td className="p-2 text-[var(--muted)]">{r.fastestCode ? `${r.fastestCode} ${r.fastestTime ?? ""}`.trim() : "—"}</td>
                  <td className="p-2 text-[var(--muted)]">{r.dnfs}</td>
                  <td className="p-2 text-[var(--muted)]">{r.pits || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {title && title.rounds.length > 1 && (
        <section aria-label={`${year} title fight`} className="card mt-6 p-5">
          <p className="panel-label">Title fight · points after every round</p>
          <TitleChart title={title} />
          <p className="tnum mt-2 text-xs text-[var(--muted)]">
            {title.codes.map((c, i) => `${c} ${title.points[title.points.length - 1][i]}`).join(" · ")}
          </p>
        </section>
      )}

      {duels.length > 0 && (
        <section aria-label={`${year} teammate battles`} className="mt-6">
          <h2 className="display text-xl font-bold">Teammates: who beat whom</h2>
          <div className="mt-2 overflow-x-auto rounded-md border border-[var(--border)]">
            <table className="tnum w-full min-w-[560px] text-sm">
              <thead>
                <tr className="panel-label border-b border-[var(--border)] text-left">
                  <th className="p-2">Team</th><th className="p-2">Pair</th>
                  <th className="p-2">Quali</th><th className="p-2">Race</th>
                </tr>
              </thead>
              <tbody>
                {duels.map((d) => (
                  <tr key={`${d.team}`} className="border-b border-[var(--border)] last:border-0">
                    <td className="p-2 text-[var(--muted)]">{d.team}</td>
                    <td className="p-2 font-bold">{d.aCode} vs {d.bCode}</td>
                    <td className="p-2">{d.qualiA}–{d.qualiB}</td>
                    <td className="p-2">{d.raceA}–{d.raceB}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-[var(--muted)]">
            Teammate duels from qualifying positions and race order. See all teams on{" "}
            <Link href="/teams" className="text-[var(--accent)] underline">/teams →</Link>
          </p>
        </section>
      )}

      <p className="mt-4 text-xs text-[var(--muted)]">
        History: Ergast mirror via Kaggle (see Methods). Replays with timing data:{" "}
        <Link href="/races" className="text-[var(--accent)] underline">pick a race →</Link>
      </p>
    </main>
  );
}

function TitleChart({ title }: { title: TitleYear }) {
  const W = 600;
  const H = 160;
  const PAD = 28;
  const n = title.rounds.length;
  const max = Math.max(1, ...title.points.flat());
  const xs = (i: number) => (n <= 1 ? W / 2 : PAD + (i * (W - PAD * 2)) / (n - 1));
  const ys = (v: number) => H - PAD - (v / max) * (H - PAD * 2);
  const paths = title.codes.slice(0, 3).map((_, k) => {
    const pts = title.points.map((row) => row[k] ?? 0);
    return pts.map((v, i) => `${i === 0 ? "M" : "L"}${xs(i).toFixed(1)},${ys(v).toFixed(1)}`).join(" ");
  });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full" role="img" aria-label={`Title fight ${title.year}`}>
      {[0, 0.5, 1].map((f) => (
        <line key={f} x1={PAD} x2={W - 8} y1={ys(max * f)} y2={ys(max * f)} stroke="var(--border)" strokeWidth="1" />
      ))}
      {paths.map((d, i) => (
        <path key={title.codes[i]} d={d} fill="none" strokeWidth="2.5"
          stroke={i === 0 ? "var(--accent)" : i === 1 ? "var(--good)" : "var(--muted)"} />
      ))}
      {title.codes.slice(0, 3).map((c, i) => (
        <text key={c} x={W - 8} y={ys(title.points[n - 1][i] ?? 0)} textAnchor="end"
          fontSize="11" fontWeight="700" fill="var(--text)" dy="-4">{c}</text>
      ))}
    </svg>
  );
}
