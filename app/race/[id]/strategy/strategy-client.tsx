"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useReplayStore } from "@/stores/replayStore";
import { indexAtT, lapAtT } from "@/lib/clock";
import { DRS_GAP_S, STRATEGY, THREAT } from "@/lib/config";
import { loadRaceBundle, type RaceBundle } from "@/lib/race";
import type { LapRow } from "@/lib/types";
import { loadJson } from "@/lib/data";
import { StateCard } from "@/components/StateCard";


export function StrategyClient({ raceId }: { raceId: string }) {
  const { t } = useReplayStore();
  const [bundle, setBundle] = useState<RaceBundle | null>(null);
  const [driver, setDriver] = useState<string>("");
  const [pitLap, setPitLap] = useState<number>(0);
  const [tyre, setTyre] = useState<string>("MEDIUM");
  const [pitLoss, setPitLoss] = useState<number>(22);
  const [stationary, setStationary] = useState<number>(2.4);

  useEffect(() => {
    let live = true;
    (async () => {
      const b = await loadRaceBundle(raceId);
      if (!live) return;
      setBundle(b);
      if (b.status === "ready" && b.meta) {
        const top = [...b.drivers].sort((a, c) => (a.finish ?? 99) - (c.finish ?? 99))[0];
        setDriver(top?.code ?? "");
        setPitLap(lapAtT(b.meta.lapStarts, 0) + 5);
        const losses = (await loadJson<{ duration: number | null }[]>(`${raceId}/pits.json`)).data
          ?.map((p) => p.duration)
          .filter((d): d is number => d != null) ?? [];
        if (losses.length > 0) {
          losses.sort((a, b2) => a - b2);
          setPitLoss(Math.round(losses[Math.floor(losses.length / 2)] * 10) / 10);
        }
      }
    })();
    return () => {
      live = false;
    };
  }, [raceId]);

  const sim = useMemo(() => {
    if (!bundle?.positions || !bundle.meta || !driver) return null;
    const i = indexAtT(bundle.positions.t, t);
    if (i < 0) return null;
    const order = bundle.drivers
      .map((d) => ({ d, pos: bundle.positions?.drivers[d.code]?.pos[Math.min(i, (bundle.positions?.drivers[d.code]?.pos.length ?? 1) - 1)] ?? null }))
      .filter((r) => r.pos != null)
      .sort((a, b) => (a.pos as number) - (b.pos as number));
    const me = order.findIndex((r) => r.d.code === driver);
    if (me < 0) return null;
    const gapsBehind: { code: string; gap: number }[] = [];
    for (const r of order.slice(me + 1)) {
      const s = bundle.intervals?.drivers[r.d.code];
      const g = s ? s.gapAhead[Math.min(indexAtT(s.t, t), s.gapAhead.length - 1)] : null;
      if (g != null) gapsBehind.push({ code: r.d.code, gap: g });
    }
    const jumpers = gapsBehind.filter((g) => g.gap < pitLoss).map((g) => g.code);
    const rejoin = me + 1 + jumpers.length;
    const aheadCar = order[rejoin - 2];
    const traffic = gapsBehind.find((g) => Math.abs(g.gap - pitLoss) < DRS_GAP_S);
    return { pos: me + 1, rejoin, jumpers, aheadCar: aheadCar?.d.code, traffic, order };
  }, [bundle, t, driver, pitLoss]);

  const options = useMemo(() => {
    if (!sim || !bundle?.stats) return [];
    const degr = bundle.stats.degradation[driver] ?? {};
    const slopes = Object.values(degr).map((d) => d.slopeSPerLap);
    const wear = slopes.length
      ? slopes.reduce((a, b) => a + b, 0) / slopes.length
      : STRATEGY.defaultWearSPerLap;
    const mk = (name: string, delayLaps: number, stay: boolean) => {
      const gainPerLap = stay ? 0 : Math.max(0, wear - STRATEGY.freshTyreEdgeSPerLap);
      const gap10 = gainPerLap * STRATEGY.horizonLaps;
      return { name, rejoin: stay ? sim.pos : sim.rejoin + delayLaps, gap10, stay };
    };
    return [mk("PIT NOW", 0, false), mk("PIT +3", 0, false), mk("STAY OUT", 0, true)];
  }, [sim, bundle, driver]);

  const threats = useMemo(() => {
    if (!bundle?.positions) return [];
    const i = indexAtT(bundle.positions.t, t);
    if (i < 0 || !sim) return [];
    const out: { code: string; gap: number; pct: number }[] = [];
    for (const r of sim.order.slice(sim.pos)) {
      const s = bundle.intervals?.drivers[r.d.code];
      const g = s ? s.gapAhead[Math.min(indexAtT(s.t, t), s.gapAhead.length - 1)] : null;
      if (g == null || g > STRATEGY.threatGapS) continue;
      const age = bundle.laps[r.d.code]?.reduce<LapRow | undefined>((a, l) => l, undefined)?.tyreAge ?? 20;
      const pct = Math.max(
        THREAT.min,
        Math.min(
          THREAT.max,
          Math.round(
            (1 - g / THREAT.gapScaleS) * THREAT.basePerGap +
              (age > THREAT.oldTyreAgeLaps ? THREAT.oldTyreBonus : 0)
          )
        )
      );
      out.push({ code: r.d.code, gap: g, pct });
      if (out.length >= 4) break;
    }
    return out.sort((a, b) => b.pct - a.pct);
  }, [bundle, t, sim]);

  if (!bundle) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-10">
        <StateCard kind="loading" title="Loading strategy" text="Reading stints…" progress={70} />
      </main>
    );
  }
  if (bundle.status !== "ready" || !bundle.meta) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-10">
        <StateCard kind="error" title="Could not load this race" text="Build the race files first." />
      </main>
    );
  }

  const lap = lapAtT(bundle.meta.lapStarts, t);
  const laps = bundle.meta.laps;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-10 pt-6">
      <Link href={`/race/${raceId}/easy`} className="touch inline-flex items-center text-sm text-[var(--accent)]">
        ← Back to race
      </Link>
      <h1 className="display mt-2 text-4xl font-bold">Strategy simulator</h1>
      <p className="tnum text-xs text-[var(--muted)]">WHAT IF… · LAP {lap}</p>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <section aria-label="Inputs" className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-4">
          <p className="panel-label mb-2">Driver</p>
          <div className="flex flex-wrap gap-1.5">
            {bundle.drivers.slice(0, 10).map((d) => (
              <button key={d.code} onClick={() => setDriver(d.code)} aria-pressed={driver === d.code}
                className={`touch rounded border px-3 text-sm font-bold ${driver === d.code ? "border-[var(--accent)] text-[var(--accent)]" : "border-[var(--border-strong)] text-[var(--muted)]"}`}>
                {d.code}
              </button>
            ))}
          </div>
          <label className="mt-4 block text-sm">
            Pit on lap {pitLap}
            <input type="range" min={lap} max={laps} value={Math.max(lap, Math.min(laps, pitLap))}
              onChange={(e) => setPitLap(Number(e.target.value))} className="mt-1 w-full" aria-label="Pit on lap" />
          </label>
          <p className="panel-label mb-2 mt-3">Fit new tyres</p>
          <div className="flex gap-1.5">
            {["SOFT", "MEDIUM", "HARD"].map((c) => (
              <button key={c} onClick={() => setTyre(c)} aria-pressed={tyre === c}
                className={`touch rounded border px-4 text-sm font-bold ${tyre === c ? "border-[var(--accent)] text-[var(--accent)]" : "border-[var(--border-strong)] text-[var(--muted)]"}`}>
                {c.slice(0, 3)}
              </button>
            ))}
          </div>
          <p className="panel-label mb-1 mt-4">Assumptions</p>
          <label className="tnum block text-xs text-[var(--muted)]">
            Pit lane loss {pitLoss.toFixed(1)} s
            <input type="range" min={15} max={35} step={0.5} value={pitLoss} onChange={(e) => setPitLoss(Number(e.target.value))} className="w-full" aria-label="Pit lane loss" />
          </label>
          <label className="tnum block text-xs text-[var(--muted)]">
            Stationary stop {stationary.toFixed(1)} s
            <input type="range" min={1.8} max={6} step={0.1} value={stationary} onChange={(e) => setStationary(Number(e.target.value))} className="w-full" aria-label="Stationary stop" />
          </label>
          <p className="mt-1 text-xs text-[var(--muted)]">Taken from this race&apos;s pit data. Change them to test ideas.</p>
        </section>

        <section aria-label="Where you rejoin" className="rounded-md border border-[var(--accent)] bg-[var(--panel)] p-4">
          <p className="panel-label mb-1">Where {driver} rejoins · ESTIMATE</p>
          {sim ? (
            <>
              <p className="display text-4xl font-bold">P{sim.rejoin}</p>
              <p className="tnum text-sm text-[var(--muted)]">
                {sim.jumpers.length > 0 ? `${sim.jumpers.join(", ")} jump ahead in the stops.` : "Clear air ahead."}
              </p>
              {sim.traffic && (
                <p className="tnum mt-1 text-sm text-[var(--warn)]">
                  {sim.traffic.code} IS ~1 s AWAY — WATCH THE MIRRORS
                </p>
              )}
            </>
          ) : (
            <p className="text-[var(--muted)]">Pick a driver.</p>
          )}
        </section>
      </div>

      <section aria-label="Compare the options" className="mt-4">
        <p className="panel-label mb-2">Compare the options</p>
        <div className="overflow-x-auto rounded-md border border-[var(--border)]">
          <table className="tnum w-full min-w-[560px] text-sm">
            <thead>
              <tr className="panel-label border-b border-[var(--border)] text-left">
                <th className="p-2">Option</th><th className="p-2">Rejoins</th><th className="p-2">Tyre</th><th className="p-2">Gap trend / 10 laps</th>
              </tr>
            </thead>
            <tbody>
              {options.map((o) => (
                <tr key={o.name} className="border-b border-[var(--border)] last:border-0">
                  <td className="p-2 font-bold">{o.name}</td>
                  <td className="p-2">P{o.rejoin}</td>
                  <td className="p-2">{o.stay ? "—" : tyre.slice(0, 3)}</td>
                  <td className="p-2">{o.stay ? "wear continues" : `~${o.gap10.toFixed(1)} s gain (ESTIMATE)`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-label="AI strategist" className="mt-4 rounded-md border border-[var(--border-strong)] bg-[var(--panel)] p-4">
        <p className="panel-label mb-1">AI strategist · confidence: medium</p>
        <Strategist driver={driver} threats={threats} />
      </section>

      <section aria-label="Undercut threat" className="mt-4">
        <p className="panel-label mb-2">Undercut threat</p>
        <ul className="tnum grid gap-1 text-sm sm:grid-cols-2">
          {threats.map((x) => (
            <li key={x.code} className="flex gap-2 rounded-md border border-[var(--border)] bg-[var(--panel)] px-3 py-2">
              <span className="font-bold">{x.code}</span>
              <span className="text-[var(--warn)]">{x.pct}%</span>
              <span className="text-[var(--muted)]">{x.gap.toFixed(1)} s behind</span>
            </li>
          ))}
          {threats.length === 0 && <li className="text-[var(--muted)]">No car within threat range right now.</li>}
        </ul>
        <p className="mt-1 text-xs text-[var(--muted)]">Modelled from gap, tyre age and pit loss. Not a prediction of what the team will do.</p>
      </section>
    </main>
  );
}

function Strategist({ driver, threats }: {
  driver: string;
  threats: { code: string; gap: number; pct: number }[];
}) {
  const top = threats[0];
  if (!top) return <p>No immediate threat — protect the tyres and cover the cars behind at the normal window.</p>;
  return (
    <div>
      <p className="text-lg font-bold">Pit now. Cover the undercut.</p>
      <p className="mt-1">
        {top.code} is {top.gap.toFixed(1)} s behind. If {top.code} stops first on fresh tyres, {top.code} can
        jump {driver}. Pitting now keeps you ahead with clear air.
      </p>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Pit now ka matlab: fresh tyres, traffic nahi, aur {top.code} ka undercut fail.
      </p>
    </div>
  );
}

