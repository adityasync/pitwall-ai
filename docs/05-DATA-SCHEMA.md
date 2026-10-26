# 05 — Data schema

The pipeline writes these files. The UI reads only these. Keep field names exactly. All times are seconds since race start (`t`) unless stated. Driver keys are 3-letter codes (`NOR`).

```
public/data/
  index.json
  <race-id>/            e.g. 2025-18-singapore
    meta.json
    drivers.json
    laps.json
    stints.json
    pits.json
    positions.json
    intervals.json
    track.json
    telemetry/<CODE>.json
    weather.json
    race_control.json
    radio.json            (omit file if unavailable; set coverage.radio=false)
    moments.json
    stats.json
```

## index.json
```json
{ "seasons": [2025, 2024, 2023],
  "races": [{ "id": "2025-18-singapore", "year": 2025, "round": 18, "name": "Singapore GP",
              "circuit": "Marina Bay Street Circuit", "date": "2025-10-05",
              "coverage": { "telemetry": true, "radio": false, "weather": true, "intervals": true },
              "featured": true, "story": "Safety car swing" }] }
```

## meta.json
`{ id, name, circuit, date, laps, sessionKey, startOffset, lapStarts: [t0, t1, ...], coverage }`

## drivers.json
`[{ code, number, name, team, teamColour, grid, finish, status }]`

## laps.json
`{ NOR: [{ lap, t, time, s1, s2, s3, compound, tyreAge, inLap, outLap, flagged, pitLane }] }`
`flagged` = safety car, virtual safety car, yellow; used to exclude from pace.

## stints.json and pits.json
`stints: { NOR: [{ stint, compound, lapStart, lapEnd, ageAtStart }] }`
`pits: [{ driver, lap, t, duration, stationary? }]`

## positions.json
Sampled at ~1 Hz for the tower and ~4 Hz for the map.
`{ hz: 4, t: [..], drivers: { NOR: { pos: [..], x: [..], y: [..] } } }`
Use compact arrays (not an object per sample) to keep the file small.

## intervals.json
`{ t: [..], drivers: { NOR: { gapLeader: [..], gapAhead: [..], ahead: ["VER", ...] } } }`

## track.json
```json
{ "outline": [[x, y], ...], "bounds": [minx, miny, maxx, maxy],
  "corners": [{ "n": 7, "x": 0, "y": 0, "dist": 2310, "name": "Turn 7" }],
  "brakingZones": [{ "corner": 7, "startDist": 2205, "endDist": 2310, "trust": "DERIVED" }],
  "sectors": [0, 1650, 3410] }
```

## telemetry/<CODE>.json
Per lap, resampled every 5–10 m of lap distance so any two laps overlay.
`{ lap: { "41": { dist: [..], speed: [..], throttle: [..], brake: [..], gear: [..], drs: [..], time: [..] } } }`
Include only: fastest 3 laps, every 5th lap, and laps around each moment. Keep each driver under about 1.5 MB gzipped.
Build with `--telemetry-drivers all` to write the whole field (2026-19-singapore ships 22 drivers). `coverage.telemetryDrivers` must list exactly the files that exist so the UI never probes missing ones.

## weather.json / race_control.json / radio.json
`weather: { t: [..], air: [..], track: [..], rain: [..], wind: [..] }`
`race_control: [{ t, lap, category, flag, message }]`
`radio: [{ t, lap, driver, url, transcript? }]`  — transcript only if you generate one; mark it DERIVED.

## moments.json (the heart of the product)
```json
[{ "id": "m_042", "t": 3120, "lap": 41, "type": "overtake|pit|gap|flag|fastest|tyre|incident",
   "drivers": ["NOR", "VER"],
   "headline": "Norris closes in on Verstappen",
   "evidence": [{ "label": "Gap", "value": "1.2 s → 0.6 s", "trust": "MEASURED" },
                { "label": "Tyre age", "value": "NOR 9 vs VER 18 laps", "trust": "MEASURED" }],
   "explain": {
     "easy": { "en": "...", "hi": "..." },
     "pro":  { "en": "...", "hi": "..." } },
   "confidence": "high|medium|low",
   "links": { "page": "compare", "params": { "d": "NOR,VER", "lap": 41 } } }]
```
`hi` is Hinglish (Hindi in Roman script, English terms kept for F1 words).
The explanation text is generated from `evidence` only (see `07-AI-RULES.md`).

## stats.json
Computed facts the AI and pages may quote.
```json
{ "pace": { "NOR": { "median": 91.2, "bestLap": 89.4, "trust": "DERIVED" } },
  "degradation": { "NOR": { "stint3": { "slopeSPerLap": 0.07, "trust": "ESTIMATE" } } },
  "undercut": [{ "lap": 30, "attacker": "NOR", "target": "VER", "gainS": 1.4, "trust": "ESTIMATE" }],
  "overtakes": [], "fastestLap": {}, "sectorBest": {}, "cornerLoss": [
    { "pair": "NOR-VER", "corner": 7, "lossS": 0.12, "apexKmh": [90, 94], "trust": "DERIVED" }] }
```

## Size budget
Per race: under 8 MB total gzipped; Easy mode needs under 400 KB before first paint. Run `pnpm data:check` to enforce.
