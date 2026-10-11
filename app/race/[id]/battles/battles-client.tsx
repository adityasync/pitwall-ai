"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useReplayStore } from "@/stores/replayStore";
import { indexAtT, lapAtT } from "@/lib/clock";
import { BATTLE_CLOSE_S_PER_LAP, BATTLE_GAP_S, DRS_GAP_S } from "@/lib/config";
import { fmtGap } from "@/lib/format";
import { loadRaceBundle, type RaceBundle } from "@/lib/race";
import { StateCard } from "@/components/StateCard";

export function BattlesClient({ raceId }: { raceId: string }) {
  const { t } = useReplayStore();
  const [bundle, setBundle] = useState<RaceBundle | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      const b = await loadRaceBundle(raceId);
      if (!live) return;
      setBundle(b);
    })();
    return () => {
      live = false;
    };
  }, [raceId]);

  const battles = useMemo(() => {
    if (!bundle?.intervals || !bundle.meta) return [];
    const out: { chaser: string; target: string; gap: number; laps: number }[] = [];
    for (const [code, s] of Object.entries(bundle.intervals.drivers)) {
      const i = indexAtT(s.t, t);
      if (i < 0) continue;
      const g = s.gapAhead[i];
      const ahead = s.ahead[i];
      if (g == null || ahead == null || g > BATTLE_GAP_S || g < 0) continue;
      // sustained? count consecutive samples under the battle threshold
      let j = i;
      let n = 0;
      while (j >= 0 && s.gapAhead[j] != null && (s.gapAhead[j] as number) <= BATTLE_GAP_S) {
        n++;
        j--;
      }
      out.push({ chaser: code, target: ahead, gap: g, laps: n });
    }
    return out.sort((a, b) => a.gap - b.gap);
  }, [bundle, t]);

  const overtakes = useMemo(() => {
    if (!bundle) return [];
    return bundle.moments
      .filter((m) => m.type === "overtake" && m.t <= t)
      .sort((a, b) => b.t - a.t)
      .slice(0, 15);
  }, [bundle, t]);

  const gains = useMemo(() => {
    if (!bundle?.positions || !bundle.meta) return [];
    const i = indexAtT(bundle.positions.t, t);
    if (i < 0) return [];
    return bundle.drivers
      .map((d) => {
        const s = bundle.positions?.drivers[d.code];
        const pos = s ? s.pos[Math.min(i, s.pos.length - 1)] : null;
        return { code: d.code, delta: d.grid != null && pos != null ? d.grid - pos : 0 };
      })
      .sort((a, b) => b.delta - a.delta);
  }, [bundle, t]);

  const lap = bundle?.meta ? lapAtT(bundle.meta.lapStarts, t) : 1;

  if (!bundle) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-10">
        <StateCard kind="loading" title="Loading battles" text="Reading gaps…" progress={70} />
      </main>
    );
  }
  if (bundle.status !== "ready") {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-10">
        <StateCard kind="error" title="Could not load this race" text="Build the race files first." />
      </main>
    );
  }

  const first = battles[0];
  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-10 pt-6">
      <Link href={`/race/${raceId}/easy`} className="touch inline-flex items-center text-sm text-[var(--accent)]">
        ← Back to race
      </Link>
      <h1 className="display mt-2 text-4xl font-bold">Battles and overtakes</h1>

      <section aria-label="Active battles" className="mt-6">
        <p className="panel-label mb-2">Active battles · within 2 seconds · lap {lap}</p>
        {battles.length === 0 ? (
          <StateCard kind="empty" title="No active battles" text="Scrub to a part of the race where cars run close." />
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {battles.slice(0, 8).map((b) => (
              <li key={b.chaser} className="tnum rounded-md border border-[var(--border)] bg-[var(--panel)] p-4">
                <p className="font-bold">
                  {b.chaser} → {b.target}
                </p>
                <p className="text-sm text-[var(--muted)]">
                  {fmtGap(b.gap)} behind · {b.gap <= DRS_GAP_S ? "DRS range" : "closing"} · {b.laps} samples close
                </p>
                <Link href={`/race/${raceId}/compare?d=${b.chaser},${b.target}`} className="touch mt-1 inline-flex text-sm text-[var(--accent)]">
                  Compare traces →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {first && (
        <section aria-label="AI battle call" className="mt-4 rounded-md border border-[var(--border-strong)] bg-[var(--panel)] p-4">
          <p className="panel-label mb-1">AI battle call</p>
          <BattleCall chaser={first.chaser} target={first.target} gap={first.gap} />
        </section>
      )}

      <section aria-label="Overtakes so far" className="mt-6">
        <p className="panel-label mb-2">Overtakes so far · {overtakes.length} shown</p>
        <ul className="grid gap-2">
          {overtakes.map((m) => (
            <li key={m.id} className="tnum rounded-md border border-[var(--border)] bg-[var(--panel)] p-3 text-sm">
              <span className="text-[var(--muted)]">LAP {m.lap} · </span>
              <strong>{m.drivers[0]}</strong> passed <strong>{m.drivers[1]}</strong> for P{m.headline.match(/P(\d+)/)?.[1] ?? "?"}
              <Link href={`/race/${raceId}/easy?t=${Math.round(m.t)}&m=${m.id}`} className="touch ml-3 text-[var(--accent)]">
                Replay
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-[var(--muted)]">
          Overtake data can be incomplete, and pit-stop position swaps are tagged separately.
        </p>
      </section>

      <section aria-label="Drive of the day" className="mt-6">
        <p className="panel-label mb-2">Drive of the day · places gained</p>
        <ul className="tnum grid gap-1 text-sm sm:grid-cols-2">
          {gains.slice(0, 6).map((g) => (
            <li key={g.code} className="flex gap-2 rounded-md border border-[var(--border)] bg-[var(--panel)] px-3 py-2">
              <span className="font-bold">{g.code}</span>
              <span style={{ color: g.delta > 0 ? "var(--good)" : g.delta < 0 ? "var(--bad)" : "var(--muted)" }}>
                {g.delta > 0 ? `+${g.delta}` : g.delta}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-1 text-xs text-[var(--muted)]">Grid slot minus current position.</p>
      </section>
    </main>
  );
}

function BattleCall({ chaser, gap }: { chaser: string; target: string; gap: number }) {
  const laps = gap > 0.05 ? Math.max(1, Math.round(gap / BATTLE_CLOSE_S_PER_LAP)) : 1;
  return (
    <div>
      <p>
        {chaser} gets DRS in about {laps} lap{laps > 1 ? "s" : ""}. The gap is {gap.toFixed(1)} s —
        under a second means the chasing car can use DRS on the next straight.
      </p>
      <p className="mt-1 text-sm text-[var(--muted)]">
        {laps} lap mein {chaser} DRS range mein aa jayega.
      </p>
    </div>
  );
}
