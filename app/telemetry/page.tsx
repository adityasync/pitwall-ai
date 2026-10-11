"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { loadJson } from "@/lib/data";
import { StateCard } from "@/components/StateCard";
import { TraceChart, type TraceLap } from "@/components/TraceChart";
import type { Driver, Meta, Track } from "@/lib/types";

type TeleFile = { lap: Record<string, { dist: number[]; speed: number[]; throttle: number[]; brake: number[]; gear: number[]; drs: number[] }> };
type Note = { at: number; text: string };

function Lab() {
  const search = useSearchParams();
  const [races, setRaces] = useState<{ id: string; name: string }[]>([]);
  const [raceId, setRaceId] = useState<string | null>(search.get("race"));
  const [meta, setMeta] = useState<Meta | null>(null);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [track, setTrack] = useState<Track | null>(null);
  const [covered, setCovered] = useState<string[]>([]);
  const [code, setCode] = useState<string>("");
  const [file, setFile] = useState<TeleFile | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [noteText, setNoteText] = useState("");
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      const idx = await loadJson<{ races: { id: string; name: string }[] }>("index.json");
      if (!live || idx.status !== "ready" || !idx.data) return;
      setRaces(idx.data.races);
      if (!raceId && idx.data.races.length > 0) setRaceId(idx.data.races[0].id);
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
      const [m, dr, tr] = await Promise.all([
        loadJson<Meta>(`${raceId}/meta.json`),
        loadJson<Driver[]>(`${raceId}/drivers.json`),
        loadJson<Track>(`${raceId}/track.json`),
      ]);
      if (!live) return;
      setMeta(m.data);
      setDrivers(dr.data ?? []);
      setTrack(tr.data);
      const cov: string[] = m.data?.coverage.telemetryDrivers ?? [];
      setCovered(cov);
      setCode(cov[0] ?? "");
      setFile(null);
      setPicked([]);
      setNotes(loadNotes(raceId));
    })();
    return () => {
      live = false;
    };
  }, [raceId]);

  useEffect(() => {
    let live = true;
    (async () => {
      if (!code) return;
      const r = await loadJson<TeleFile>(`${raceId}/telemetry/${code}.json`);
      if (!live) return;
      if (r.status === "ready" && r.data) {
        setFile(r.data);
        const laps = Object.keys(r.data.lap).sort((a, b) => Number(a) - Number(b));
        setPicked(laps.slice(0, 3));
      }
    })();
    return () => {
      live = false;
    };
  }, [raceId, code]);

  const colour = drivers.find((d) => d.code === code)?.teamColour ?? "#2de2e6";
  const traces: TraceLap[] = useMemo(() => {
    if (!file) return [];
    return picked.filter((l) => file.lap[l]).map((l) => {
      const L = file.lap[l];
      return { code: `${code}·${l}`, colour, dist: L.dist, speed: L.speed, throttle: L.throttle, brake: L.brake, gear: L.gear };
    });
  }, [file, picked, code, colour]);

  const cornerNote = useMemo(() => {
    if (cursor == null || !track || track.corners.length === 0) return null;
    let best = track.corners[0];
    for (const c of track.corners) {
      if (Math.abs(c.dist - cursor) < Math.abs(best.dist - cursor)) best = c;
    }
    const d = Math.abs(best.dist - cursor);
    return d < 400 ? `TURN ${best.n} APPROACH` : null;
  }, [cursor, track]);

  const addNote = () => {
    if (cursor == null || !noteText.trim()) return;
    const n = [...notes, { at: Math.round(cursor), text: noteText.trim().slice(0, 140) }].sort((a, b) => a.at - b.at);
    setNotes(n);
    try {
      localStorage.setItem(`pitwall-notes-${raceId}`, JSON.stringify(n));
    } catch {
      /* private mode */
    }
    setNoteText("");
  };

  const exportCSV = () => {
    if (!file || picked.length === 0) return;
    const L = file.lap[picked[0]];
    const rows = ["dist_m,speed_kmh,throttle,brake,gear"];
    for (let i = 0; i < L.dist.length; i++) {
      rows.push(`${L.dist[i]},${L.speed[i]},${L.throttle[i]},${L.brake[i]},${L.gear[i]}`);
    }
    download(`${raceId}-${code}-lap${picked[0]}.csv`, "text/csv", rows.join("\n"));
  };

  const exportPNG = async () => {
    const svg = chartRef.current?.querySelector("svg");
    if (!svg) return;
    const xml = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    const url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml" }));
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = rej;
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = 1600;
    canvas.height = 520;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#111113";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    canvas.toBlob((b) => {
      if (!b) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(b);
      a.download = `${raceId}-${code}.png`;
      a.click();
    });
  };

  const link = `/telemetry?race=${raceId}`;

  if (!raceId) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-10">
        <StateCard kind="loading" title="Finding telemetry" text="Loading the race list…" progress={50} />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-10 pt-6">
      <p className="panel-label">Telemetry lab · {meta?.name ?? raceId}</p>
      <h1 className="display mt-1 text-4xl font-bold">Any laps, any channels</h1>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {races.map((r) => (
          <button key={r.id} onClick={() => setRaceId(r.id)} aria-pressed={raceId === r.id}
            className={`touch rounded border px-3 text-xs font-bold ${raceId === r.id ? "border-[var(--accent)] text-[var(--accent)]" : "border-[var(--border-strong)] text-[var(--muted)]"}`}>
            {r.name}
          </button>
        ))}
      </div>
      <div className="tnum mt-2 flex flex-wrap items-center gap-1.5 text-xs">
        <span className="panel-label w-full">Driver · telemetry covers {covered.join(", ") || "none"}</span>
        {covered.map((c) => (
          <button key={c} onClick={() => setCode(c)} aria-pressed={code === c}
            className={`touch rounded border px-3 font-bold ${code === c ? "border-[var(--accent)] text-[var(--accent)]" : "border-[var(--border-strong)] text-[var(--muted)]"}`}>
            {c}
          </button>
        ))}
      </div>

      {file ? (
        <>
          <p className="panel-label mb-1 mt-4">Laps on the chart · {picked.length} of {Object.keys(file.lap).length}</p>
          <div className="tnum flex flex-wrap gap-1.5 text-xs">
            {Object.keys(file.lap).sort((a, b) => Number(a) - Number(b)).map((l) => (
              <button key={l} onClick={() => setPicked((p) => (p.includes(l) ? p.filter((x) => x !== l) : [...p, l].slice(-6)))}
                aria-pressed={picked.includes(l)}
                className={`touch rounded border px-2.5 ${picked.includes(l) ? "border-[var(--accent)] text-[var(--accent)]" : "border-[var(--border-strong)] text-[var(--muted)]"}`}>
                lap {l}
              </button>
            ))}
          </div>
          <div ref={chartRef} className="mt-2 rounded-md border border-[var(--border)] bg-[var(--panel)] p-3">
            <TraceChart laps={traces} cursor={cursor} onCursor={setCursor} height={300} />
          </div>
          {cursor != null && (
            <p className="tnum mt-1 text-sm text-[var(--accent)]">
              CURSOR · {Math.round(cursor).toLocaleString()} M{cornerNote ? ` · ${cornerNote}` : ""}
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            <button onClick={() => { void navigator.clipboard?.writeText(window.location.origin + link); }}
              className="touch rounded-md border border-[var(--border-strong)] px-4 text-sm font-semibold">Copy link</button>
            <button onClick={() => void exportPNG()}
              className="touch rounded-md border border-[var(--border-strong)] px-4 text-sm font-semibold">PNG</button>
            <button onClick={exportCSV}
              className="touch rounded-md border border-[var(--border-strong)] px-4 text-sm font-semibold">Export CSV</button>
            <Link href={`/race/${raceId}/compare?d=${code}`} className="touch inline-flex items-center rounded-md border border-[var(--accent)] px-4 text-sm font-bold text-[var(--accent)]">
              Open these laps in Compare
            </Link>
          </div>
          <section aria-label="Notes" className="mt-4 rounded-md border border-[var(--border)] bg-[var(--panel)] p-4">
            <p className="panel-label mb-2">Notes · saved with the link on this device</p>
            <ul className="tnum grid gap-1 text-sm">
              {notes.map((n, i) => (
                <li key={i}>@{n.at.toLocaleString()} m — {n.text}</li>
              ))}
              {notes.length === 0 && <li className="text-[var(--muted)]">No notes yet.</li>}
            </ul>
            <div className="mt-2 flex gap-2">
              <input value={noteText} onChange={(e) => setNoteText(e.target.value.slice(0, 140))}
                placeholder="+ Add a note at the cursor" aria-label="Add a note at the cursor"
                className="touch min-w-0 flex-1 rounded-md border border-[var(--border-strong)] bg-[var(--raised)] px-3 text-sm" />
              <button onClick={addNote} disabled={cursor == null}
                className="touch rounded-md bg-[var(--accent)] px-4 text-sm font-bold text-black disabled:opacity-50">Add</button>
            </div>
          </section>
        </>
      ) : (
        <div className="mt-4">
          <StateCard kind="empty" title="No traces for this driver" text={`Telemetry covers ${covered.join(", ") || "no drivers"} in this replay.`} />
        </div>
      )}
      <p className="mt-3 text-xs text-[var(--muted)]">
        Brake is an on/off signal. Samples arrive about 3.7 times a second and are resampled to
        distance, so very short events can be smoothed. See Methods.
      </p>
    </main>
  );
}

function loadNotes(raceId: string): Note[] {
  try {
    return JSON.parse(localStorage.getItem(`pitwall-notes-${raceId}`) ?? "[]") as Note[];
  } catch {
    return [];
  }
}

function download(name: string, type: string, text: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
}

export default function TelemetryRoute() {
  return (
    <Suspense fallback={<main className="mx-auto w-full max-w-5xl px-4 py-10"><p className="text-[var(--muted)]">Loading…</p></main>}>
      <Lab />
    </Suspense>
  );
}
