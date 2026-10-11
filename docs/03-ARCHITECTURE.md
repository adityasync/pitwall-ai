# 03 — Architecture

## Shape
```
 OpenF1 / FastF1 (historical)
        │  Python pipeline (offline, run by you)
        ▼
 public/data/<race-id>/*.json   ← static files, committed or uploaded
        │  served by Vercel CDN
        ▼
 Next.js app (App Router, TypeScript, Tailwind)
   ├─ replay clock + stores
   ├─ pages (Easy, Pro, analysis suite)
   └─ /api/ask  →  Z.ai LLM  (grounded by the stats pack)
```
There is no database and no always-on server. The only runtime function is `/api/ask`. Explanations for tapped moments are **pre-generated at build time** and stored in `moments.json`, so the hero flow works with zero AI latency and zero runtime cost.

## Stack
- Frontend: Next.js (App Router) + TypeScript + Tailwind. Deploy on Vercel.
- State: Zustand (`replayStore`, `selectionStore`, `uiStore`).
- Charts: custom SVG for track map and tower; `uPlot` or `visx` for telemetry traces (fast with many points).
- Data pipeline: Python 3.11, `fastf1`, `requests`, `numpy`, `pandas`. Output JSON.
- AI: Z.ai API via a Next route handler. Key in env, never in the browser.
- Tests: Vitest for TS stat helpers, pytest for the pipeline.

## Folder layout
```
/app
  page.tsx                    landing
  races/page.tsx              pick a race
  race/[id]/{easy,pro,compare,corners,strategy,pace,battles,recap,radio,quali}/page.tsx
  race/[id]/driver/[code]/page.tsx
  {ask,explorer,telemetry,standings,season,h2h,export,methods,follow}/page.tsx
  api/ask/route.ts
/components   timing-tower, track-map, trace-chart, tyre-bars, ai-card, evidence-strip,
              trust-badge, mode-toggle, lang-toggle, playback-bar, command-palette, states
/lib          data.ts (fetch+cache), clock.ts, stats.ts, format.ts, i18n.ts, ai.ts
/stores       replayStore.ts, selectionStore.ts, uiStore.ts
/public/data  index.json, <race-id>/...
/pipeline     build_race.py, detect_moments.py, compute_stats.py, explain_moments.py, requirements.txt
/docs         these files
```

## The replay clock
One source of truth: `replayStore = { raceId, t (seconds since race start), playing, speed (1,2,5,10,30), lap }`.
- A `requestAnimationFrame` loop advances `t` by `dt * speed` when playing.
- Every panel derives its view from `t` using binary search on pre-sorted arrays. Never re-fetch on tick.
- `lap` is derived from `t` using the lap-start table in `laps.json`.
- Scrubbing, tapping a moment and deep links all set `t`.
- Positions arrays are sampled at about 1 Hz for the tower and about 4 Hz for the map; telemetry is per-lap and by distance (not by time) for traces.

## Loading strategy
- `index.json` loads first (race list, coverage badges).
- On entering a race: load `meta`, `drivers`, `laps`, `stints`, `pits`, `moments`, `stats` (small, about 100–300 KB).
- Load `positions` and `track` for the Pro map; load `telemetry/<driver>.json` lazily when a driver is selected.
- Gzip/brotli from Vercel. Target first interactive under 2 s on 4G for Easy mode.

## Live mode (optional, behind a flag)
If `NEXT_PUBLIC_LIVE=1` and an OpenF1 paid token exists, a thin client polls OpenF1 and feeds the same stores. Otherwise the app shows the "Live data is switched off" state and offers the replay. Do not block any release on this.

## Trust labels in code
Every stat in `stats.json` and every evidence item has `trust: "MEASURED" | "DERIVED" | "ESTIMATE"`. `<TrustBadge>` renders it. A panel showing mixed trust shows each.

## Error handling
Each fetch returns `{ data, status }`. Pages render States components (loading, empty, error, no-radio, live-off). Never show a blank panel.

## Performance and accessibility
- Memoise derived series; avoid re-rendering the tower on every frame (update only on position change or at 10 Hz).
- Respect `prefers-reduced-motion`: pause auto-play animations.
- Keyboard: Space play/pause, ← → step lap, Ctrl-K palette.
