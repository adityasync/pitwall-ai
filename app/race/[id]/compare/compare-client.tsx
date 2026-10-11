"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useUiStore } from "@/stores/uiStore";
import { loadJson } from "@/lib/data";
import { StateCard } from "@/components/StateCard";
import { TraceChart, deltaSeries, type TraceLap } from "@/components/TraceChart";
import type { Driver, Meta, Track } from "@/lib/types";

type TeleFile = { lap: Record<string, { dist: number[]; speed: number[]; throttle: number[]; brake: number[]; gear: number[]; drs: number[] }> };

export function ComparePage({ raceId }: { raceId: string }) {
  const search = useSearchParams();
  const { lang } = useUiStore();
  const [meta, setMeta] = useState<Meta | null>(null);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [track, setTrack] = useState<Track | null>(null);
  const [files, setFiles] = useState<Record<string, TeleFile>>({});
  const [missing, setMissing] = useState<string[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [cursor, setCursor] = useState<number | null>(null);
  const [showPro, setShowPro] = useState(false);

  const codes = useMemo(() => {
    const d = (search.get("d") ?? "").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
    return d.length >= 2 ? d.slice(0, 2) : [];
  }, [search]);

  useEffect(() => {
    let live = true;
    (async () => {
      const [m, dr, tr] = await Promise.all([
        loadJson<Meta>(`${raceId}/meta.json`),
        loadJson<Driver[]>(`${raceId}/drivers.json`),
        loadJson<Track>(`${raceId}/track.json`),
      ]);
      if (!live) return;
      if (m.status !== "ready" || !m.data) {
        setStatus("error");
        return;
      }
      setMeta(m.data);
      if (dr.status === "ready" && dr.data) setDrivers(dr.data);
      if (tr.status === "ready" && tr.data) setTrack(tr.data);
      const covered: string[] = m.data.coverage.telemetryDrivers ?? [];
      const pair = codes.length === 2 ? codes : covered.slice(0, 2);
      const got: Record<string, TeleFile> = {};
      const miss: string[] = [];
      // only fetch files the pipeline wrote — uncovered codes go straight to the empty state
      for (const c of pair) {
        if (!covered.includes(c)) {
          miss.push(c);
          continue;
        }
        const r = await loadJson<TeleFile>(`${raceId}/telemetry/${c}.json`);
        if (!live) return;
        if (r.status === "ready" && r.data && Object.keys(r.data.lap).length > 0) got[c] = r.data;
        else miss.push(c);
      }
      setFiles(got);
      setMissing(miss);
      setStatus("ready");
    })();
    return () => {
      live = false;
    };
  }, [raceId, codes]);

  const pair = useMemo(() => Object.keys(files), [files]);
  const commonLaps = useMemo(() => {
    if (pair.length < 2) return [];
    const a = new Set(Object.keys(files[pair[0]].lap));
    return Object.keys(files[pair[1]].lap).filter((l) => a.has(l)).sort((x, y) => Number(x) - Number(y));
  }, [files, pair]);

  const lapParam = search.get("lap");
  const lap = lapParam && commonLaps.includes(lapParam) ? lapParam : commonLaps[commonLaps.length - 1] ?? null;

  const traces: TraceLap[] = useMemo(() => {
    if (!lap || pair.length < 2) return [];
    return pair.map((code) => {
      const L = files[code].lap[lap];
      const colour = drivers.find((d) => d.code === code)?.teamColour ?? "#fff";
      return { code, colour, dist: L.dist, speed: L.speed, throttle: L.throttle, brake: L.brake, gear: L.gear };
    });
  }, [files, pair, lap, drivers]);

  const delta = useMemo(
    () => (pair.length === 2 ? deltaSeries(traces[0], traces[1]) : null),
    [traces, pair]
  );

  const atCursor = useMemo(() => {
    if (cursor == null || pair.length < 2) return null;
    const read = (tr: TraceLap) => {
      let bi = 0;
      for (let i = 0; i < tr.dist.length; i++) {
        if (Math.abs(tr.dist[i] - cursor) < Math.abs(tr.dist[bi] - cursor)) bi = i;
      }
      return { speed: tr.speed[bi], gear: tr.gear?.[bi], brake: tr.brake?.[bi] };
    };
    let di = 0;
    if (delta) {
      for (let i = 0; i < delta.dist.length; i++) {
        if (Math.abs(delta.dist[i] - cursor) < Math.abs(delta.dist[di] - cursor)) di = i;
      }
    }
    return { a: read(traces[0]), b: read(traces[1]), d: delta ? delta.delta[di] : null };
  }, [cursor, traces, delta, pair]);

  const verdict = useMemo(() => {
    if (pair.length < 2 || !delta || delta.delta.length === 0) return null;
    const end = delta.delta[delta.delta.length - 1];
    const [a, b] = pair;
    const ahead = end < 0 ? b : a;
    return {
      ahead,
      by: Math.abs(end),
      en: `${ahead} ends lap ${lap} ahead by ${Math.abs(end).toFixed(2)} s on comparable traces.`,
      hi: `Is lap mein ${ahead} ${Math.abs(end).toFixed(2)} second aage raha.`,
      pro: `Cumulative delta over lap ${lap}: ${ahead} +${Math.abs(end).toFixed(2)} s. Delta integrates speed over distance; brake is on/off so braking detail is approximate.`,
    };
  }, [delta, pair, lap]);

  if (status === "loading") {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 sm:px-6 py-10">
        <StateCard kind="loading" title="Loading traces" text="Fetching lap telemetry…" progress={70} />
      </main>
    );
  }
  if (status === "error" || !meta) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 sm:px-6 py-10">
        <StateCard kind="error" title="Could not load this race" text="Build the race files first." />
      </main>
    );
  }
  if (pair.length < 2) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 sm:px-6 py-10">
        <StateCard
          kind="empty"
          title="Telemetry covers only some drivers"
          text={`This replay has traces for ${(meta.coverage.telemetryDrivers ?? []).join(", ") || "no drivers"}. Pick two of them with ?d=A,B.${missing.length > 0 ? ` Missing: ${missing.join(", ")}.` : ""}`}
          action={<Link href={`/race/${raceId}/easy`} className="touch inline-flex items-center rounded-md bg-[var(--accent-deep)] px-5 font-semibold text-white">Back to race</Link>}
        />
      </main>
    );
  }

  const [a, b] = pair;
  const W = 800;
  const H = 120;
  const PADL = 44;
  const maxD = Math.max(1, ...delta!.dist);
  const maxAbs = Math.max(0.05, ...delta!.delta.map((v) => Math.abs(v)));
  const X = (d: number) => PADL + (d / maxD) * (W - PADL - 8);
  const Y = (v: number) => H / 2 - (v / maxAbs) * (H / 2 - 10);
  const dPath = delta!.dist.map((d, i) => `${i === 0 ? "M" : "L"}${X(d).toFixed(1)},${Y(delta!.delta[i]).toFixed(1)}`).join(" ");

  return (
    <main className="mx-auto w-full max-w-5xl px-4 sm:px-6 pb-12 pt-5">
      <Link href={`/race/${raceId}/easy`} className="touch inline-flex items-center text-sm text-[var(--accent)]">
        ← Back to race
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="display text-4xl font-bold">COMPARE</h1>
        <span className="tnum rounded border border-[var(--border-strong)] px-2 py-1 text-sm">LAP {lap}</span>
        <span className="display text-2xl font-bold">{a} <span className="text-[var(--muted)]">vs</span> {b}</span>
        <Link href={`/race/${raceId}/compare?d=${b},${a}${lap ? `&lap=${lap}` : ""}`}
          className="touch inline-flex items-center rounded-md border border-[var(--border-strong)] px-3 text-sm">
          Swap drivers
        </Link>
      </div>

      <div className="tnum mt-3 flex flex-wrap gap-2 text-xs">
        <span className="panel-label w-full">Lap</span>
        {commonLaps.map((l) => (
          <Link key={l} href={`/race/${raceId}/compare?d=${a},${b}&lap=${l}`}
            className={`touch inline-flex items-center rounded border px-2.5 ${l === lap ? "border-[var(--accent)] text-[var(--accent)]" : "border-[var(--border-strong)] text-[var(--muted)]"}`}>
            {l}
          </Link>
        ))}
      </div>

      <section aria-label="Speed traces" className="mt-4 card p-3">
        <p className="panel-label mb-1">Speed · throttle · brake on/off · gear — by distance</p>
        <div className="tnum mb-1 flex gap-4 text-xs">
          {traces.map((tr) => (
            <span key={tr.code} style={{ color: tr.colour }}>■ {tr.code}</span>
          ))}
        </div>
        <TraceChart laps={traces} cursor={cursor} onCursor={setCursor} />
      </section>

      <section aria-label="Time delta" className="mt-3 card p-3">
        <p className="panel-label mb-1">Time delta ({b} ahead when below zero) · seconds</p>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 120 }} role="img" aria-label="Cumulative time delta">
          <line x1={PADL} x2={W - 8} y1={H / 2} y2={H / 2} stroke="var(--border-strong)" strokeWidth={1} />
          <path d={dPath} fill="none" stroke="var(--accent)" strokeWidth={2} />
        </svg>
      </section>

      {cursor != null && atCursor && (
        <section aria-label="At the cursor" className="tnum mt-3 grid grid-cols-3 gap-2 text-center text-sm">
          <div className="card p-3">
            <p className="text-[var(--muted)]">{a}</p>
            <p className="text-lg font-bold">{Math.round(atCursor.a.speed)} km/h · gear {atCursor.a.gear} · brake {atCursor.a.brake ? "ON" : "OFF"}</p>
          </div>
          <div className="card p-3">
            <p className="text-[var(--muted)]">{b}</p>
            <p className="text-lg font-bold">{Math.round(atCursor.b.speed)} km/h · gear {atCursor.b.gear} · brake {atCursor.b.brake ? "ON" : "OFF"}</p>
          </div>
          <div className="card p-3">
            <p className="text-[var(--muted)]">DELTA · {Math.round(cursor).toLocaleString()} m</p>
            <p className="text-lg font-bold">{atCursor.d != null ? `${atCursor.d >= 0 ? "+" : ""}${atCursor.d.toFixed(2)} s` : "—"}</p>
          </div>
        </section>
      )}

      {verdict && (
        <section aria-label="AI verdict" className="mt-3 rounded-md border border-[var(--border-strong)] bg-[var(--panel)] p-4">
          <p className="panel-label mb-1">AI verdict · beginner · Hinglish</p>
          <p>{lang === "hi" ? verdict.hi : verdict.en}</p>
          {showPro && <p className="mt-1 text-sm text-[var(--muted)]">{verdict.pro}</p>}
          <button onClick={() => setShowPro(!showPro)} className="touch mt-1 text-sm text-[var(--accent)] underline">
            {showPro ? "Hide pro version" : "Show pro version"}
          </button>
        </section>
      )}

      {track && track.brakingZones.length > 0 && (
        <section aria-label="Braking zones on this lap" className="mt-3 card p-4">
          <p className="panel-label mb-2">Braking zones on this lap · DERIVED</p>
          <ul className="tnum grid gap-1 text-sm sm:grid-cols-2">
            {track.brakingZones.map((z, i) => (
              <li key={i}>T{z.corner ?? "?"} · brake {Math.round(z.startDist).toLocaleString()} → {Math.round(z.endDist).toLocaleString()} m</li>
            ))}
          </ul>
        </section>
      )}
      <p className="mt-3 text-xs text-[var(--muted)]">
        Traces resampled every 10 m of lap distance. Brake is an on/off signal, so very short events can be smoothed. See Methods.
      </p>
    </main>
  );
}
