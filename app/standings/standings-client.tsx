"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useReplayStore } from "@/stores/replayStore";
import { indexAtT } from "@/lib/clock";
import { RACE_POINTS_SCALE } from "@/lib/config";
import { loadJson } from "@/lib/data";
import { loadRaceBundle, type RaceBundle } from "@/lib/race";
import { StateCard } from "@/components/StateCard";

const SCALE = RACE_POINTS_SCALE;

type ChampRow = { number: number; before: number | null; after: number | null };
type ChampTeam = { team: string; before: number | null; after: number | null };

export function StandingsClient() {
  const { t } = useReplayStore();
  const [races, setRaces] = useState<{ id: string; name: string }[]>([]);
  const [raceId, setRaceId] = useState<string | null>(null);
  const [bundle, setBundle] = useState<RaceBundle | null>(null);
  const [champ, setChamp] = useState<{ drivers: ChampRow[]; teams: ChampTeam[] } | null>(null);
  const [tab, setTab] = useState<"drivers" | "teams">("drivers");

  useEffect(() => {
    let live = true;
    (async () => {
      const idx = await loadJson<{ races: { id: string; name: string }[] }>("index.json");
      if (!live || idx.status !== "ready" || !idx.data) return;
      setRaces(idx.data.races);
      const last = idx.data.races[idx.data.races.length - 1]?.id ?? null;
      if (last) setRaceId(last);
    })();
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (!raceId) return;
    let live = true;
    (async () => {
      const [b, c] = await Promise.all([
        loadRaceBundle(raceId),
        loadJson<{ drivers: ChampRow[]; teams: ChampTeam[] }>(`${raceId}/standings.json`),
      ]);
      if (!live) return;
      setBundle(b);
      setChamp(c.status === "ready" ? c.data : { drivers: [], teams: [] });
    })();
    return () => {
      live = false;
    };
  }, [raceId]);

  const rows = useMemo(() => {
    if (!bundle?.positions || !bundle || !champ) return null;
    const i = indexAtT(bundle.positions.t, t);
    if (i < 0) return null;
    const order = bundle.drivers
      .map((d) => ({ d, pos: bundle.positions?.drivers[d.code]?.pos[Math.min(i, 99_999)] ?? null }))
      .filter((r) => r.pos != null)
      .sort((a, b) => (a.pos as number) - (b.pos as number));
    return order.map((r, idx) => {
      const pts = idx < SCALE.length ? SCALE[idx] : 0;
      const base = champ.drivers.find((c) => c.number === r.d.number);
      const before = base?.before ?? null;
      return {
        code: r.d.code,
        racePos: r.pos as number,
        gain: pts,
        before,
        now: before != null ? Math.round((before + pts) * 10) / 10 : null,
      };
    });
  }, [bundle, champ, t]);

  const teams = useMemo(() => {
    if (!rows || !bundle || !champ) return [];
    const byTeam: Record<string, number> = {};
    rows.forEach((r) => {
      const team = bundle.drivers.find((d) => d.code === r.code)?.team ?? "?";
      byTeam[team] = (byTeam[team] ?? 0) + r.gain;
    });
    return Object.entries(byTeam)
      .map(([team, pts]) => {
        const base = champ.teams.find((c) => c.team === team);
        return { team, pts, before: base?.before ?? null, now: base?.before != null ? Math.round((base.before + pts) * 10) / 10 : null };
      })
      .sort((a, b) => (b.now ?? 0) - (a.now ?? 0));
  }, [rows, bundle, champ]);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-10 pt-6">
      <p className="panel-label">Standings · if the race ended now</p>
      <h1 className="display mt-1 text-4xl font-bold">The title fight, live.</h1>
      <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
        Championship points as they would stand at this lap, using standard race points.
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {races.map((r) => (
          <button key={r.id} onClick={() => setRaceId(r.id)} aria-pressed={raceId === r.id}
            className={`touch rounded border px-3 text-xs font-bold ${raceId === r.id ? "border-[var(--accent)] text-[var(--accent)]" : "border-[var(--border-strong)] text-[var(--muted)]"}`}>
            {r.name}
          </button>
        ))}
        <span className="ml-auto flex gap-1.5">
          {(["drivers", "teams"] as const).map((x) => (
            <button key={x} onClick={() => setTab(x)} aria-pressed={tab === x}
              className={`touch rounded border px-3 text-xs font-bold uppercase ${tab === x ? "border-[var(--accent)] text-[var(--accent)]" : "border-[var(--border-strong)] text-[var(--muted)]"}`}>
              {x}
            </button>
          ))}
        </span>
      </div>

      {!rows ? (
        <div className="mt-4">
          <StateCard kind="loading" title="Loading standings" text="Reading points…" progress={70} />
        </div>
      ) : rows.every((r) => r.before == null) ? (
        <div className="mt-4">
          <StateCard kind="empty" title="No championship baseline" text="The championship beta has no points for this race — showing race points only." />
        </div>
      ) : tab === "drivers" ? (
        <div className="mt-4 overflow-x-auto rounded-md border border-[var(--border)]">
          <table className="tnum w-full min-w-[640px] text-sm">
            <thead>
              <tr className="panel-label border-b border-[var(--border)] text-left">
                <th className="p-2">Title pos</th><th className="p-2">Driver</th><th className="p-2">Race pos</th>
                <th className="p-2">This race</th><th className="p-2">Before</th><th className="p-2">Now</th>
              </tr>
            </thead>
            <tbody>
              {[...rows].sort((a, b) => (b.now ?? 0) - (a.now ?? 0)).map((r, i) => (
                <tr key={r.code} className="border-b border-[var(--border)] last:border-0">
                  <td className="p-2">{i + 1}</td>
                  <td className="p-2 font-bold">{r.code}</td>
                  <td className="p-2">P{r.racePos}</td>
                  <td className="p-2 text-[var(--good)]">+{r.gain}</td>
                  <td className="p-2 text-[var(--muted)]">{r.before}</td>
                  <td className="p-2 font-bold">{r.now}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-md border border-[var(--border)]">
          <table className="tnum w-full min-w-[480px] text-sm">
            <thead>
              <tr className="panel-label border-b border-[var(--border)] text-left">
                <th className="p-2">Team</th><th className="p-2">This race</th><th className="p-2">Before</th><th className="p-2">Now</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((x) => (
                <tr key={x.team} className="border-b border-[var(--border)] last:border-0">
                  <td className="p-2 font-bold">{x.team}</td>
                  <td className="p-2 text-[var(--good)]">+{x.pts}</td>
                  <td className="p-2 text-[var(--muted)]">{x.before ?? "—"}</td>
                  <td className="p-2 font-bold">{x.now ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-xs text-[var(--muted)]">
        Points use the standard race scale of 25, 18, 15, 12, 10, 8, 6, 4, 2, 1. Sprint weekends,
        fastest-lap rules and penalties after the flag can change the final numbers.
      </p>
      <Link href="/ask" className="touch mt-2 inline-flex text-sm text-[var(--accent)]">
        Ask the AI about the title fight →
      </Link>
    </main>
  );
}
