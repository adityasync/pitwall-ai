# PITWALL.AI — full codebase walkthrough

The complete tour: every folder and file (except env files, `.git`, `node_modules`, `.next`, `.venv`),
why each thing exists, why the stack is what it is, and how to talk about it in an interview.
Pair with `docs/DECISIONS.md` (dated log of every pivot) — this doc explains the *system as it stands*.

---

## 1. The one-minute story

PITWALL.AI explains a Formula 1 race. Tap a moment, understand why — English or Hinglish.
It is built on one deliberate bet: **the hard work happens offline, the site only serves results.**

```
OpenF1 REST API (historical, free, 2023+)
        │
        ▼
pipeline/*.py    run on a laptop or GitHub Actions — never at runtime
  build_race.py        → fetch (retry + cache) → clean → resample → derive
  detect_moments.py    → overtakes / pits / flags / gap battles (+ 4 template packs)
  compute_stats.py     → pace, degradation, fastest lap
  explain_moments.py   → offline LLM writes every explanation, validators gate it
        │
        ▼
public/data/<race>/*.json      ~16 files per race, ~1–4 MB, committed to git
        │  served as static files (Vercel CDN, 1 h cache + SWR)
        ▼
Next.js App Router (React 19)   ~1126 prerendered pages
  lib/*      fetch + math + validators
  stores/*   one replay clock for every screen (zustand)
  app/*      Easy/Pro race views, Ask, Telemetry lab, Strategy, History…
        │
        └── one runtime API: /api/ask  →  Z.ai glm-4.5-flash (grounded) → validators
                                        → Neon Postgres cache → template fallback
```

Three rules shape every line of code:

1. **Replay first.** Live OpenF1 needs a paid plan. Every screen works from pre-computed race files ("replays"). Live was prototyped in `/live`, found broken on the free feed, and removed on 2026-10-12.
2. **The AI never invents numbers.** It only quotes a "context pack" computed by Python/TS code. Validators enforce it, and an eval set (20 questions, 9 traps) proves it.
3. **Every number carries a trust label** — `MEASURED` (straight from the feed), `DERIVED` (computed from primary data), `ESTIMATE` (a model with documented assumptions). This flows from the pipeline through the types, the UI badges, and the AI prompts.

---

## 2. Why this stack — every choice with the alternative rejected

| Choice | Why | Alternative rejected |
|---|---|---|
| **Next.js 16 App Router** | File-based routing for ~30 routes × 35 races; `generateStaticParams` prerenders every race/driver combo (1126 pages) so first paint is instant; `next/og` for share cards; metadata for `?d=`,`?t=` deep links | Vite SPA — fine technically, but loses SEO/OG, image route, streaming Suspense, and static param generation |
| **`cacheComponents` (Next 16)** | Dynamic-by-default, explicit caching. The app is almost entirely client-fetch-driven, so aggressive server caching would only hide stale data. Dynamic shaders keep the honest "loading" -> "data" states visible | Default Next caching — would serve stale race files silently |
| **Static JSON on CDN, no runtime data backend** | Free, fast, never sleeps, survives a demo. Fits "replay first": data is historical by construction | Free-tier server that sleeps (Render) or DB at runtime (cost, latency, failure modes) |
| **`/data/*` headers: `max-age=3600, SWR`** | Race files change only when the pipeline re-runs, so 1 h cache is correct; SWR hides rebuild gaps | `no-store` everywhere — wasted MB/s per user; `no-store` is used only for `track.json` so rebuilt outlines can never hide behind cache (decision log row of 2026-10-13) |
| **React 19** | App Router is built on it; stable Suspense/streaming; modern `cache()`-free data loading is irrelevant here because fetches are explicit in `useEffect` + `lib/data.ts` | nothing controversial |
| **Tailwind v4 (CSS-first)** | Tokens live in `globals.css` as CSS custom properties (`--accent #E10600`, `--panel`, `--good`…), components use utilities; zero runtime; easy `VELOCITY` re-theme in one file | styled-components / Tailwind v3 config-file approach |
| **zustand (3 stores, not Context)** | Replay clock must be readable/written *outside* React: the rAF loop, the keyboard handler (`PlaybackKeys`), the palette. `useReplayStore.getState()` + selector-based subscriptions keep re-renders surgical; `persist` middleware stores `mode`/`lang` for free | Redux (heavy, ceremony), Context (re-render whole trees on every commit tick) |
| **pnpm + `pnpm-workspace.yaml`** | Fast installs, one place for the node/js and python "packages" (repo effectively has app / pipeline / service / data sub-projects) | npm/yarn |
| **Python + `requests` + `numpy` pipeline** | Data crunching (resample 20 cars × 3.7 Hz telemetry, distance integration, outlier scrubs, per-lap joins) is batch work — done once per race at build time, cheap anywhere | Doing it in the browser per visit (wasted CPU, inconsistent) or a runtime server (cost, sleep) |
| **OpenF1 as primary source** | Free historical from 2023; cleaned endpoints for position, intervals, car_data, location, pit, laps, radio, race_control, weather — one coherent session-key model | FastF1 (kept as documented fallback / Methods), Ergast (retired; mirror CSVs used for 1950–2026 history only, never for timing) |
| **Distance = ∫ speed dt (10 m grid)** | OpenF1 `location` x/y is an arbitrary coordinate system (~7 units ≈ 1 m), has no lateral lane info, and has GPS blackspots (Monaco tunnel). Integrating speed gives one honest shared distance axis for telemetry, corners, braking zones, comparos | Using raw location for anything quantitative |
| **Positions forward-filled to 1 Hz; intervals kept raw (~4 s)** | Position only changes on change events; forward-filling gives a stable indexable series. Gaps are ~4 s samples — resampling them would fake data | Resampling intervals (invents numbers) |
| **SVG everywhere, zero chart libraries** | Every chart is bespoke to the canvas design (tower, mirrored traces, delta band, tilt-labelled tables); keeps bundle small; CSS-var theming; the telemetry chart is serializable to PNG in the lab | recharts/chart.js ( fought the design, added 100s of KB ) |
| **Neon Postgres — only for the Ask cache** | The one runtime write (AI answers) benefits from a free always-on DB. `@neondatabase/serverless` talks HTTP — works inside serverless functions with no connection pooling pains. Key = `sha256(normalized question, raceId, lang)`, TTL 30 days | Vercel KV (another vendor), in-memory (evicted per deployment) |
| **Z.ai `glm-4.5-flash`** | Cheap/free, fast, OpenAI-compatible endpoint — good enough *because* the validators, not the model, guarantee honesty | Big closed models (cost), no LLM at all (loses the "why" writing) |
| **GitHub Actions `ingest.yml`** | Daily 02:00 UTC + manual `workflow_dispatch {year,}` backfill. Finds and builds new races, runs `check_data` budgets, commits `public/data`, push triggers Vercel deploy. Free CI becomes the freshness crawler | A cron on Render (sleeps, ephemeral disk) |
| **FastAPI on Render (service/)** | Optional Phase-2 backend: rebuild-on-demand over HTTP (`/v1/ingest`), freshness endpoint, file proxy. The Next app treats it purely as *progressive enhancement* — `NEXT_PUBLIC_API_BASE` first, static fallback always works | Making it load-bearing — would break the "nothing sleeps" rule |
| **Fonts: Anton + Barlow + JetBrains Mono (`next/font`)** | Broadcast-look display type, humanist body, mono numerals (`.tnum`) so digits don't jiggle in a timing tower. Self-hosted by Next = no CLS, no Google Fonts privacy hit | icon-fonts / third font stacks |

---

## 3. Everything on disk — folder by folder

```
PitWallAi/
├─ AGENTS.md / README.md            harness rules / project story
├─ SUBMISSION-NOTE.txt              the ≤200-word note (171 words)
├─ package.json / pnpm-lock.yaml    scripts: dev, build, lint, typecheck, test,
│                                   data:build 2025 18, data:all, data:quali,
│                                   data:history, data:outlines, data:check
├─ next.config.ts                   cacheComponents; /data 1h+SWR headers
├─ tsconfig.json, eslint.config.mjs
├─ .env.example                     ZAI key, NEON DATABASE_URL, NEXT_PUBLIC_API_BASE,…
├─ render.yaml                      FastAPI service deploy spec
├─ .github/workflows/ingest.yml     daily 02:00 UTC ingest + manual backfill
├─ docs/                            01..10 product/design/data docs + DECISIONS.md + this file
├─ pipeline/                        Python: build + detect + stats + explain + eval + tests
├─ lib/                             TypeScript: types, config, data, clock, race, map, ai…
├─ stores/                          zustand: replayStore, selectionStore, uiStore
├─ app/                             Next.js routes (see §6)
├─ components/                      18 shared components (see §6)
├─ service/                         FastAPI optional backend
├─ public/data/                     35 race folders + history/ + index.json (committed!)
├─ data/                            14 Ergast-mirror CSVs (history only)
├─ scripts/                         small shell helpers (check, outlines)
└─ pipeline/cache/                  gitignored raw OpenF1 response cache
```

---

## 4. The data layer — `pipeline/`

### `build_race.py` (≈811 lines, the heart)

One invocation `python pipeline/build_race.py 2023 16` writes one race folder. Stages:

1. **Fetch** — OpenF1 session lookup by year+round, pulls `drivers`, `position`, `intervals`,
   `laps`, `pit`, `stints`, `location`, `car_data` (top telemetry drivers only), `weather`,
   `race_control`, `team_radio`. Every call retried with backoff and cached in
   `pipeline/cache/` (gitignored) so re-runs never refetch.
2. **Clean & resample**
   - **Positions** forward-filled to a 1 Hz grid — position only updates on change, the tower needs a stable index.
   - **Intervals** kept at raw ~4 s cadence as `{t, gapAhead[], ahead[]}` per driver — resampling would invent numbers.
   - **Telemetry** (speed/throttle/brake/gear/DRS) resampled onto a **10 m distance grid computed
     by integrating speed (`v dt`)** — because coordinate units are not meters and channel cadence
     is ~3.7 Hz. This one decision makes every derived artifact (corners, braking zones, deltas,
     corner apexes, onboard playback) share one honest axis.
   - **NaN fix (`_clean_channel`)**: the 2026 feed sends nulls inside DRS arrays; naive
     `json.dump` emits bare `NaN` which is invalid JSON — the cleaner maps NaN→None.
   - **Red-flag pit stops**: land durations >120 s are nulled (the car sits for hours; a "pit duration" would be fiction).
3. **Derive**
   - **Track outline** from the location trace, then (after the map fixes) superseded by
     `rebuild_outlines.py`'s field-median of all clean laps; smoothing uses closed Catmull–Rom with edge-padding.
   - **Corners** = apex speed minima along distance; **braking zones** = runs of the binary brake
     channel. Both live in `track.json` with trust labels.
   - **`meta.json`**: `{id, name, circuit, date, laps, sessionKey, startOffset, lapStarts[],
     coverage{telemetry, telemetryDrivers[], radio, weather, intervals}}` — `lapStarts[]` is
     what the entire replay clock keys on.
4. **Write** all ~16 files (see §8 for sizes/shapes) and patch `index.json`.
5. **Budgets** — `check_data.py` enforces race ≤8 MB and per-file/index caps so 40 races never bloat the repo.

### `detect_moments.py`
Deterministic detectors in race coordinates:
- **Overtake** — consecutive position samples swap *on track* (pit swaps excluded), credited with lap, order and DRS/battle context.
- **Pit** — every stop with stationary + total loss.
- **Flags** — yellow/SC/red/chequered from race_control for the Pro banner.
- **Fastest lap** + who beat it.
- **Gap battles** — pairs within `BATTLE_GAP_S` (2 s) sustained over samples.
Every moment gets an `id`, `t SEC` timestamp, `confidence` (high/medium), `evidence[]`
(label/value/trust), deep links (`links.page + params`, e.g. `compare?d=LEC,RUS&lap=1`), and
**4 pre-written template explanations** (easy/pro × en/hi) as the guaranteed fallback.

### `compute_stats.py`
`pace` per driver (median & best over *clean* laps — pit laps, SC laps and in/out laps excluded —
exclusions are the honesty), `degradation` per stint (`slopeSPerLap` from a linear fit), fastest lap, overtake list.

### `explain_moments.py` — AI at build time
Offline pass: for every moment, Z.ai `glm-4.5-flash` is given the moment's numeric pack and asked
for easy/pro × en/hi copies. **Validators gate the output**:
`numbersOk` (every quoted number appears in the pack), `surnamesOk`, `comparison_ok`
("ahead of" claims match the data), `FORBIDDEN` regex (no tyre temps, fuel, future certainty…),
`scrub_model_tic`; invalid → retried → template fallback. Result is the merged `explain` block in
`moments.json`. **This is why Easy mode costs 0 tokens and 0 ms at runtime.** Resumable `--all` for
backfills of older races.

### `build_quali.py`, `build_history.py`, housekeeping
- **`build_quali.py`** — `quali.json`: best lap, best sectors, **ideal lap = sum of personal best
  sectors (DERIVED — nobody drove it)**; the UI sells it as "left out there".
- **`build_history.py`** — reads the 14 Ergast-mirror CSVs in `data/` (14 GB-era files,
  `lap_times.csv` alone 24.8 MB) into 7 small JSONs in `public/data/history/`
  (seasons, title, teams, h2h, reliability, driver-careers, circuits). 77 years of
  history without a database. **Never used for race-time numbers.**
- **`backfill.py` / `find_new.py`** — discover unbuilt races, drive batches.
- **`fix_outlines.py` / `rebuild_outlines.py`** — the map-war ordnance (§10).
- **`test_pipeline.py`** — 7 pytest units for the math (clean-lap filters, slopes, integrator) — no network.
- **`eval/questions.json` + `eval/run_eval.py`** — the honesty eval: 20 questions, 9 of them
  traps ( asks about brake pressure, tyre temp, fuel load — things the data does not have).
  Runs the whole answer path and counts trap refusals.

---

## 5. The honesty machinery (where "trust" physically lives)

1. **Pipeline** stamps `trust` on every evidence frame and derived artifact.
2. **`lib/types.ts`** types `trust: "MEASURED" | "DERIVED" | "ESTIMATE"` on the wire.
3. **`lib/config.ts`** documents every tunable with provenance (`SPEC` FIA-style numbers like
   DRS gap 1 s, `DOMAIN` assumptions like pit loss 22 s, `MODEL` knobs like `TYRE_HEALTH_LAPS=45`).
4. **UI**: `TrustBadge` on `AiCard`, `EvidenceStrip` quoting values with their labels, per-panel
   labels on every ESTIMATE page (strategy, standings, pace wear), `≈` marks for integrated lap times, purple/green sector colours always paired with text.
5. **AI**, twice — build-time validators in Python; runtime validators in **`lib/ai-validate.ts`**
   mirroring them in TS (`numbersOk`, `surnamesOk`, `comparison_ok`, `FORBIDDEN`, scrub).
6. **Methods page** (`app/methods/page.tsx`) — the public oath: 17-row metric table
   (source → how → trust), sources list, known limits ("no brake pressure, steering, ERS, brake
   bias, tyre temperature, tyre wear, fuel load, engine modes"), and the AI-honesty paragraph.
7. **Eval** — the 20/9-trap set proves the oath holds.

---

## 6. The frontend — `lib/`, `stores/`, `app/`, `components/`

### `lib/` — the shared brain

| File | Job |
|---|---|
| `types.ts` | Every JSON shape on the wire (Meta, Driver, LapRow, Stint, Pit, Moment, Stats, PositionSeries, IntervalSeries, TrackShape, RaceEntry, Evidence…) |
| `config.ts` | Single knob table: replay `SPEEDS` (1/2/4/8), `ASK_MAX_CHARS=300`, rate limit 20/h/IP, `DRS_GAP_S=1.0`, `BATTLE_GAP_S`, `BATTLE_CLOSE_S_PER_LAP`, `TYRE_HEALTH_LAPS=45`, `MAP_TRAIL_MAX_JUMP_U=1000`, `STRATEGY` (pit loss default from race median, wear, fresh-tyre edge, 10-lap horizon), `THREAT` (percentage curve min/max/gap scale + old-tyre bonus), `RACE_POINTS_SCALE` |
| `data.ts` | `loadJson<T>(path)`: tries `NEXT_PUBLIC_API_BASE` (the FastAPI service), falls back to static `/data/...`; returns `{status: loading|ready|empty|error, data}` — the whole app's discipline for state handling; `track.json` fetched `no-store` so outline rebuilds can't hide behind cache |
| `clock.ts` | `indexAtT` binary search (last sample ≤ t, -1 before start), `lapAtT(lapStarts, t)`, `commitIntervalMs(speed)` — the throttle that makes 60 fps replays affordable (≈120 ms commits at 1×, every frame at 10×+) |
| `race.ts` | `loadRaceBundle(id)` — parallel fetch of ~13 files into one typed, status-aware bundle; every race page grabs the world in one round-trip |
| `map.ts` | `xyAt` Catmull–Rom interpolation along the outline (linear variant kept), `trailAt` (linear sampling so gaps don't curve), `splitTrailOnGaps` (>1000 u jumps break polylines — feed gap fix), `smoothOutline` (closed Catmull–Rom), `moversAt` (3 s window for pulse rings) |
| `timing.ts` | `sectorBests` (personal + session), `sectorTone` (purple/green/none — colour never the only signal), `bestLaps`, `trackStatusAtT`, `drsAtT` |
| `stats.ts` | pure math helpers surfaced to the UI (medians, fits) |
| `ai.ts` | runtime AI client: builds a **context pack** (race facts + current moment) and the grounding system prompt; calls Z.ai; never shows raw function output |
| `ai-validate.ts` | the TS twins of the Python validators — used by `/api/ask` before anything reaches the user |
| `ask-cache.ts` | Neon Postgres via HTTP driver; `sha256(normalized(q)+raceId+lang)`; 30-day TTL; silently no-ops without `DATABASE_URL` |
| `format.ts`, `i18n.ts`, `glossary.ts` | `1:23.456` times, `+1.2s` gaps; EN/Hinglish UI strings; one-line term explanations for Easy |
| `first-race.ts` | `latestRaceId()` — landing/CTAs/Ask default always point at the newest race (test: `pickLatest`) |
| `history.ts` | typed loaders for the 7 history JSONs |
| `*.test.ts` | **39 vitest tests** — clock, map, timing, validators, formatting, config sanity |

### `stores/` — the three states of the app

- **`replayStore`** — *the* replay clock: `{raceId, t, lap, playing, speed, lapStarts, seek(), set()}`.
  One source of truth; every screen (Easy/Pro/Onboard/Standings/Battles) subscribes to it, so a
  scrub in one place is "in sync everywhere" for free.
- **`selectionStore`** — followed/selected driver, selected moment.
- **`uiStore`** — persisted `mode` (easy/pro) + `lang` (en/hi) + `palette` open state.

### `app/` — every route, top to bottom

**Root**
- `layout.tsx` — fonts (Anton/Barlow/JetBrains via `next/font`), `TopBar`, `CommandPalette` (Ctrl-K), `PlaybackKeys`, skip link, html metadata.
- `globals.css` (444 lines) — the **VELOCITY** theme: CSS-var tokens (accent red family, panels, borders, fastest-purple, good-green…), utilities (`btn`, `card`, `panel-label`, `touch` = 44 px minimum, `tnum`, `display`, `race-row`, `.nice-scroll`), reduced-motion respect, slider `--fill`.
- `page.tsx` (landing) — hero console (self-playing `RaceReplayHero`: leader trail, giant lap counter), `TowerPreview` (real mid-race laps 26→36 loop from the latest race's files), `FeaturedRaces` (editorial rows with real overtake/stop/fastest counts fetched per race), honesty footer → `/methods`.
- `api/ask/route.ts` — **the only runtime AI endpoint**: 20 req/h/IP in-memory limiter, 300-char cap, context pack from local race JSON, Z.ai call with grounding prompt, `ai-validate` gauntlet, Neon cache, **template fallback so Ask never hard-fails**.
- `api/og/route.tsx` — 1200×630 share card straight from `meta.json` + `drivers.json` (podium) + first high-confidence moment headline; graceful "unknown" fallback.

**Race shell** — `race/[id]/layout.tsx`: `generateStaticParams` from `index.json` (every built race), sticky `RaceBar` (RaceTabs) with live flag chip + DRS chip when the leader gap ≤1 s, Suspense shell.
Every sub-page follows the identical pattern (`page.tsx` = sync shell + `generateStaticParams`, awaits `params`, renders `<XClient raceId>` in Suspense) — explicit decision to never await params in the layout (dev warns Route blocked instant nav; decision log 2026-10-12).

| Route | Client | What it does |
|---|---|---|
| `/race/[id]/easy` | `easy-client.tsx` (783 lines) | THE product: rAF clock loop (throttled commits), timing tower (follow-driver, battle chips with closing-rate linear fit, tyre bars, sector cells), TrackMap with trails + mover pulses, AI moment feed with `AiCard` explanations + glossary, phone tab bar; deep links `?t=`, `?m=` |
| `/race/[id]/pro` | `pro-client.tsx` (249 lines) | pure timing workstation — tower + map + live flag banner from race control; MEASURED only, no AI |
| `/race/[id]/onboard` | `onboard-client.tsx` (482 lines) | telemetry player: driver/lap pickers, distance playback at 1–8× (a lap ≈30 s at 1×), big KM/H · GEAR · THROTTLE · BRAKE readouts, DRS chip, car dot interpolated along the outline by cumulative distance, ~10 %-lap trail, SVG traces with turn-number gridlines + playhead, lap times integrated from speed when unclocked (marked ≈ / DERIVED) |
| `/race/[id]/quali` | `quali-client.tsx` | best lap + sectors (session purples), **ideal lap** + "left out there" gap — honesty in one table |
| `/race/[id]/corners` | `corners-client.tsx` | interactive TrackMap corner picker (T1…Tn), two-driver apex/brake-point/gear table, deterministic "AI corner read" (apex diff + later brush), links to Compare |
| `/race/[id]/compare` | `compare-client.tsx` | `?d=A,B&lap=L` speed/throttle/brake/gear via `TraceChart`, **cumulative time delta** (`deltaSeries` — speed integrated over distance), cursor readouts, en/hi verdict + "pro version" toggle, braking zones list |
| `/race/[id]/strategy` | `strategy-client.tsx` | what happened (StintBars + PitTable, MEASURED) → **what if** simulator (driver/pit-lap/compound sliders; assumptions seeded from *this race's* median pit loss): rejoin position = order arithmetic, jumpers, "1 s traffic" warning, options table (PIT NOW / +3 / STAY OUT with gain ≈ (wear − fresh edge) × 10 laps) → under-cut threat percentages (THREAT model) → template strategist line w/ Hinglish; everything labelled ESTIMATE |
| `/race/[id]/pace` | `pace-client.tsx` | BestLapsTable (purple/green sectors) + per-lap scatter coloured by compound + stint summary (avg + wear/lap ESTIMATE) + PaceRead from computed stats |
| `/race/[id]/battles` | `battles-client.tsx` | active battles within 2 s (counting consecutive close samples), GapChart for the top fight, deterministic BattleCall ("DRS in ~X laps"), overtakes-so-far with replay deep links, drive-of-the-day (grid − position) |
| `/race/[id]/radio` | `radio-client.tsx` | team-radio clips (`preload="none"`, jump-to-replay links), race-control feed with **plain-English regex translation**, driver filter, honest no-radio state pointing at Brazil 2024 |
| `/race/[id]/recap` | `recap-client.tsx` | full result order, *three moments that mattered*, by-the-numbers, share-card preview (`/api/og`), WhatsApp share, PNG download |
| `/race/[id]/driver/[code]` | `driver-client.tsx` | stints+stops chips, lap chart, template report ("finished Pn from grid Pn … median … DERIVED clean laps only"), driver-filtered radio, head-to-head vs teammate |

**Global pages**
- `/races` — pick-a-race index; collapsible per-year groups (newest first via date sort), Easy/Pro explainer cards, real coverage badges (REPLAY/RADIO/TEL/WX) from `RaceEntry.coverage`.
- `/methods` — the honesty page (§5).
- `/ask` — chat UI: suggested questions in en/hi, `?q=` pre-send (worked from the palette "TAB ASK"), per-race **"what the AI can see"** coverage list that *also* lists what it can't (Brake pressure NOT AVAILABLE, Tyre temperature NOT AVAILABLE, ERS NOT AVAILABLE) — the anti-hype panel.
- `/standings` — **"if the race ended now"** title fight: current race positions → points via `RACE_POINTS_SCALE` added to a `standings.json` baseline (championship endpoint is beta; gracefully degrades when baseline is empty); drivers/teams tabs; caption pins the caveats (sprints, penalties).
- `/telemetry` — Telemetry lab: any laps × any covered driver, multi-trace `TraceChart`, distance cursor with nearest-turn note, notes persisted in localStorage (`pitwall-notes-<race>`), **CSV export**, **PNG export via SVG→canvas serialization**, copy link.
- `/explorer` — session-explorer table of all 35 replays with coverage READY/NOT AVAILABLE.
- `/export` — per-race downloads (laps.json, moments.json), share-card PNG, copy share-link.
- `/follow` — favourite driver + alert prefs in localStorage (no accounts), preview → driver page.
- `/season`, `/teams`, `/drivers`, `/circuits` — the history set from `lib/history` + Ergast CSVs: 77 seasons of champions + winners + title-fight line chart (top-3, SVG) + teammate duels; 200+ constructors with titles/wins/avg pit/DNFs + "why cars retire" causes + "pit kings"; 865+ driver careers; 78 circuits with most-wins/last winner/**lap record**.

### `components/`

| Component | Notes |
|---|---|
| `TrackMap.tsx` (530) | the crown jewel, v6: outline (2 px core + 8 px halo, `vector-effect=non-scaling-stroke` — constant weight per track at any zoom), S/F tick, corner pins, braking zones (`showZones`), driver dots, **trails per driver (gap-split polylines)**, mover pulses (3 s `moversAt` window: motion + colour + ▲▼ text — never colour-only), zoom/follow, `minimal` hero mode (loop + S/F + cars only), corner selection callbacks for Corners page |
| `TopBar.tsx` | glass bar: ModeToggle (Easy/Pro), LangToggle (EN/Hinglish), ReplayBadge, 4 primary links + "More" overflow + mobile groups sheet |
| `AiCard.tsx` | headline + text + `TrustBadge` + `EvidenceStrip` (label/value/trust triples); lang-aware |
| `PlaybackBar.tsx` | play/pause, 1/2/4/8 speeds, time + lap readouts, **moment markers (high-confidence only)** — medium-confidence detections don't claim screen space |
| `StateCard.tsx` | the 6 states (loading / thinking / error / empty / no-radio + action) — every page reuses it |
| `TimingRow.tsx` | memo'd tower row; `TyreDot` (compound letter + colour), `TyreBars` (health = 1 − age/45, explicitly an ESTIMATE), gap formatting |
| `SectorCells.tsx` | memo'd purple/green mini-cells fed by *data not elements* (identity-stable object) |
| `RaceTabs.tsx` | race sub-nav with live flag + DRS chip |
| `RaceReplayHero.tsx` | self-driving landing hero (lap 18→48 loop with the leader's trail) |
| `TowerPreview.tsx` | landing's real timing tower loop (laps 26–36, `TyreDot`s, faster fastest-lap footer) |
| `CommandPalette.tsx` | Ctrl-K; race-aware entries only when a race resolves (`latestRaceId()`), Tab = ask, full keyboard |
| `PlaybackKeys.tsx` | global Space / ← → (lap-step via `lapStarts`) / Ctrl-K; ignores typing targets |
| `FeaturedRaces.tsx`, `HeroCard.tsx` | landing editorial rows + card — no hardcoded race ids (latest-resolved) |
| `BestLapsTable.tsx`, `PitTable.tsx` | pace + pit tables with purple-fastest cues and aria-hidden colour swatches |
| `LapChart`, `GapChart`, `StintBars`, `TraceChart` (+ `deltaSeries`) | hand-rolled SVG charts |

---

## 7. The AI, end-to-end (the FDE headline)

There are **two AI paths, deliberately different**:

1. **Build-time explanations** (`pipeline/explain_moments.py`) — every moment gets easy/pro × en/hi
   text offline, validated and stored in `moments.json`. Easy mode therefore renders explanations
   instantly, forever, for free — *and the AI literally cannot drift at runtime because the text is frozen after validation*.
2. **Runtime Ask** (`app/api/ask/route.ts` + `lib/ai.ts` + `lib/ai-validate.ts`):
   rate-limit → trim → **context pack** (only computed race facts) → grounded prompt →
   glm-4.5-flash → validators (`numbers` must exist in the pack; comparison claims checked;
   FORBIDDEN claims regexed out; model tics scrubbed) → evidence strip → Neon cache →
   **on any failure: deterministic template answer**. The user can always ask; the site never
   depends on the model being good, only the pack being right.

The Hinglish requirement is handled at both layers: template packs are authored in Hinglish
(`"Lap 1 par LEC ne RUS ko overtake karke P2 le liya"`) and the runtime prompt instructs
Hinglish for `lang:"hi"` — mixed-style, f1-casual, not machine-Hindi.

---

## 8. The datasets on disk

**`public/data/` — 35 race folders** (2023 → 2026), each:

```
meta.json        ~1 KB    id, name, circuit, date, laps, sessionKey, startOffset,
                          lapStarts[], coverage{telemetry, telemetryDrivers[], radio, weather, intervals}
drivers.json     ~3 KB    grid, finish, status, team, teamColour, number
positions.json   ~2.5 MB  {t[], drivers{VER: {pos[]}}}  ← 1 Hz, the clock's backbone
intervals.json   ~1 MB    {t[], drivers{VER: {gapAhead[], ahead[]}}} ← raw ~4 s cadence
laps.json        ~200 KB  per driver LapRow[] {lap, time, s1..s3, compound, tyreAge, pitLane, flagged}
stints.json      ~4 KB    per driver Stint[] {stint, compound, lapStart, lapEnd, ageAtStart}
pits.json        ~2 KB    {driver, lap, duration, stationary}  ← red-flag >120 s nulled
moments.json     ~373 KB  300–500 moments: {id, t, lap, type, drivers, headline,
                          evidence[], explain{easy,pro}×{en,hi}, confidence, links}
stats.json       ~16 KB   pace, degradation per stint, fastestLap, overtakes
track.json       ~7 KB    outline[], corners[] {n, dist}, brakingZones[] — rebuilt field-median
quali.json       ~16 KB   best, bestSectors, ideal(DERIVED)
standings.json   ~1 KB    before/after championship baseline
weather.json     ~5 KB, race_control.json ~9 KB, radio.json ~12 KB (urls stream from source)
telemetry/       ~230 KB × 3 drivers (telemetryDrivers — coverage is limited, and that's stated)
```

**`public/data/history/`** — 7 JSONs (seasons, title, teams, h2h, reliability, drivers, circuits) ≈80 KB gz total.
**`public/data/index.json`** — the race list the whole app bootstraps from (oldest→newest; `latestRaceId` picks the tail).
**`data/*.csv`** — the 14 Ergast-mirror files (from Kaggle); `lap_times.csv` is 24.8 MB; used only by `build_history.py`.

---

## 9. The optional backend & the freshness loop

**`service/app.py`** (FastAPI, deployed by `render.yaml`):
`/health` (index stats), `/v1/index` (same shape as static index), `/v1/freshness`
(file mtimes → the UI can say "updated Xh ago"), `/v1/race/{id}/{path}` (any built file, with a
path-traversal guard + `.json`-only rule), and `POST /v1/ingest` guarded by `INGEST_SECRET`
running `build_race.py` + `build_quali.py` via subprocess. The lifespan hook is pre-wired for
Phase 2: the official F1 live-timing socket writing into the *same* `public/data` tree, so
readers need zero changes. **Design rule encoded in comments: committed `public/data` is the
source of truth; Render disk is ephemeral; the Next app treats the service as progressive enhancement.**

**`.github/workflows/ingest.yml`** — schedule `2:00 UTC` daily + `workflow_dispatch` (manual
backfill with a year/round input): find/build new races, `check_data` budgets, commit
`public/data`, push → Vercel deploys. CI is the tiny ops team that would otherwise not exist.

---

## 10. War stories — the bugs that shaped the architecture (interview gold)

1. **The map war (2026-10-11 → 13), six rounds.** Outline rendering looked broken for weeks:
   it wasn't the renderer — stored outlines were *the whole-race GPS trace* (a scribble), then a
   single-reference-lap slice that didn't match the same race's position dots (sector offset ~470 u),
   then unit-scaled stroke widths that weighted every circuit differently. The fix that stuck:
   `rebuild_outlines.py` re-derives every outline as the **pointwise median of all clean laps**
   (field consensus), gated on cross-lap agreement; rendering switched to
   `vector-effect=non-scaling-stroke` (2 px core/8 px halo). Lesson: when two datasets disagree,
   the field median is more honest than any single reference.
2. **Feed gaps ⇒ trail chords.** Singapore-2026 traces contained 1800–2200 u sample jumps.
   Points verified on-track (≤1 % span) — so the *data* was fine and the *presentation* lied by
   bridging gaps. `splitTrailOnGaps` (>1000 u) renders honest broken polylines. Audit of all 34
   races found gaps in every race (Monaco ×4 → Vegas ×1852), zero teleports, max 405 u jitter:
   **verified-not-fixed beats fixed-not-verified.**
3. **2026 feed nulls → invalid JSON.** Null DRS samples dumped as bare `NaN` (legal Python, illegal
   JSON) and broke consumers; `_clean_channel` scrubs NaN→None.
4. **Monaco tunnel GPS blackout** — the outline keeps a straight-ish section under the tunnel;
   dots follow the same path so they stay on the ribbon. Documented, not papered over.
5. **Sepang labelled "Bahrain" in the feed** — the build keeps the feed's session name in
   `sessionKey` but trusts year+round lookup, so the race files carry the real name.
6. **Stale tab ghost.** User screenshots of "broken maps" were rendered by the pre-rewrite
   renderer in a long-lived dev tab (HMR had been killed when `.next` was cleared under the
   server). Reproduced *from current code in isolation* to prove the geometry was impossible,
   then fixed the real hole it exposed: `track.json` is now fetched `no-store` so rebuilt
   outlines can never hide behind cache. Lesson: reproduce from the current tree before patching.
7. **Live mode removal.** `/live` polled OpenF1 `session_key=latest` every 3 s with paid-feed
   empty states behind `NEXT_PUBLIC_LIVE` — it shipped, never showed data (free feed), and was
   deleted outright rather than left half-built. Non-negotiable: **a finished small app beats a
   half-built large one.**
8. **1126 prerendered pages at one `build`.** SSE of the whole concept: the shell pattern
   (sync page + Suspense + async inner) + `generateStaticParams` everywhere makes "every race ×
   every analysis page" free at the edge.

---

## 11. Numbers cheat sheet (know these cold)

- DRS window: gap **< 1.0 s** · battles: **< 2 s** sustained · threat range: `STRATEGY.threatGapS`
- Tyre health bar: **1 − age/45** (`TYRE_HEALTH_LAPS`), an ESTIMATE until a degradation model lands
- Telemetry: **~3.7 Hz** raw → **10 m** distance grid · coordinate scale ≈ **7 units/m**
- Positions forward-filled to **1 Hz** · intervals raw **~4 s**
- Ask: **300 chars** in, **~400 tokens** out, **20 req/h/IP**, Neon cache TTL **30 days**
- Trail gap threshold **1000 u** · mover pulse window **3 s** · tower flash 30 s→3 s alignment
- Replay speeds **1/2/4/8** · onboard lap playback **30 s at 1×** · commit throttle **≈120 ms @1×**
- Points scale **25-18-15-12-10-8-6-4-2-1** · race budget **≤8 MB**, per-file caps by `check_data`
- 35 race folders · 7 history JSONs · 14 CSVs · **1126 prerendered pages**
- Tests: **39 vitest** (lib) + **7 pytest** (pipeline) + **20-question honesty eval (9 traps)**

---

## 12. The demo script (90 seconds)

1. **Landing** — hero replays by itself; tower preview ticks real data; "WORTH REWATCHING" rows
   carry real overtake counts. Say: *"Everything here is pre-computed; the AI wrote these lines
   at build time, off data, not at runtime."*
2. **Pick a race → Easy** — let the clock run; tap a moment in the AI feed; the map pulses where
   it happened; `AiCard` shows the evidence strip: *"every number labelled measured/derived/estimate."*
3. **Flip to Pro** — same dataset, different presentation (toggle changes pixels, not data).
4. **Compare** — pick the two drivers from the moment; the delta curve shows exactly where the
   pass happened; scroll the traces; point out *"brake is an on/off channel — I never fake pressure."*
5. **Strategy** — note the panel label: *"inputs are labelled ESTIMATE; happening-size numbers —
   stints and stops — are measured from the feed."*
6. **Ask** — ask "Why did the leader pit then?" in Hinglish; show the evidence strip and the
   "what the AI can see" panel that admits what's not available (brake pressure: NOT AVAILABLE).
7. **Methods** — close on the oath page. *"If the data can't answer, the app says so."*

**Three things to name-drop naturally:** the offline-validation chain (both layers),
the flag-battle eval (20 questions/9 traps), the GitHub-Actions freshness loop committing data → Vercel.

---

## 13. Interview Q&A drill

**Why is everything static?** Historical race data only changes when built; static files give
free CDN speed, zero sleep risk, committed audit trail; the single runtime cost is `/api/ask`,
cached in Neon. The optional FastAPI service exists, but `lib/data.ts` falls back to static files,
so nothing depends on it being awake.

**Why Next.js? Why not Vite?** 1126 prerendered pages over 35 races × ~30 routes, `generateStaticParams`,
OG image route, streaming Suspense shells, metadata per race — file-based SSG is the core value,
not convenience.

**Why zustand?** The replay clock must be shared by screens *and* by non-React code (rAF loop,
keyboard handler, palette). Provider-free `getState()` + selectors keep re-renders at exactly the
components that care; `persist` handles the mode/language knobs for free.

**How does the AI not make things up?** It never sees raw data — a context pack of computed facts
is all it gets; its output is regex- and set-validated (numbers must exist in the pack, driver
surnames must exist, comparative claims must match); failures fall back to templates that are
provable from the JSON; and the traps eval measures how often it refuses questions the data cannot answer.

**What's the hardest bug you fixed?** The map: three layers of wrong (whole-race trace, single-lap
slice, unit-scaled widths) each *looked* like a rendering bug; the durable fix was data-level —
field-median outlines + non-scaling strokes — and the audit habit it taught: reproduce from the
current tree, verify the across-races invariants (0 NaN, 0 teleports, outline/dot agreement), and
prefer *verified-not-fixed* over blind patches.

**Why no chart libraries?** The design is bespoke broadcast-style; SVG + CSS-vars gives full control,
tiny bundles, and makes telemetry export (SVG→PNG) trivial. The charts are the easy part once the
data axis (distance integral) is right.

**How would you add live?** The lifespans are already carved: OpenF1 paid socket → ingest runs the
same `build_*` shapes into `public/data` (or the service's lifespan hook reads the socket in);
screens already render "replay mode" with a badge — the mode flag just flips. The removal proved the
shape: nothing in the UI blocked live; the feed did.

**What would you do next (honestly)?** Upgrade the tyre model from `1 − age/45` to degradation-based
health; radio transcripts (where released); per-driver tower slim views; the Phase-2 live socket.
And the gaps stated on Methods: no brake pressure/steering/ERS/tyre temp — anything built on those
would need a different data contract, not a promise.

---

## 14. What's gitignored / not in the walkthrough

`.env*` (keys), `node_modules/`, `.next/`, `.git/`, `.venv/`, `pipeline/cache/` (raw OpenF1
responses), OS litter. Everything else that ships in this repo is covered above.
