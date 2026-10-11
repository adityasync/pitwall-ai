# 04 — Data sources and hard limits

Verify every endpoint and rate limit against the live docs before relying on it (`https://openf1.org`, `https://docs.fastf1.dev`). Data availability changes.

## Sources
| Source | Use | Access |
|---|---|---|
| **OpenF1** | Primary. REST JSON. Historical data from 2023 onwards is free; real-time needs a paid subscription | `https://api.openf1.org/v1/<endpoint>?session_key=...` |
| **FastF1** (Python) | Convenient loader with caching; good for laps, telemetry by lap, track outline | `pip install fastf1`, uses a local cache folder |
| Ergast-style results | Season and standings fallback if OpenF1 championship endpoints are missing | check current availability |

Pick one primary per field to avoid mismatches. Suggested: OpenF1 for everything; FastF1 only if it saves effort for lap telemetry. Record the choice in `DECISIONS.md`.

## OpenF1 endpoints we use
`sessions`, `meetings`, `drivers`, `laps`, `stints`, `pit`, `position`, `intervals`, `car_data`, `location`, `overtakes`, `race_control`, `weather`, `team_radio`, `championship_drivers`, `championship_teams` (beta, race sessions only).

## What each gives, and the limit
| Field | Notes and limits |
|---|---|
| `car_data` | speed, rpm, gear, throttle, brake, DRS at about 3.7 Hz per driver. **Brake is binary (0 or 100)**, not pressure |
| `location` | x, y, z track coordinates. **No lateral lane position** |
| `laps` | lap and sector times. Segment mini-sectors are **not available in races** |
| `intervals` | gap to leader and car ahead, about every 4 s, **races only** |
| `stints` / `pit` | compound, lap range, tyre age at start; pit lap and duration |
| `position` | position changes over time |
| `overtakes` | recorded overtakes |
| `race_control` | flags, safety car, penalties |
| `weather` | air/track temperature, humidity, rain, wind |
| `team_radio` | audio URLs. **Coverage sharply reduced in 2026**; treat as optional per race |
| `championship_*` | beta, race sessions only |

## Signals we do NOT have (never imply them)
Brake pressure, steering angle, ERS deployment, brake bias, tyre temperature, tyre wear, fuel load, engine modes, car setup. Anything built on these is an **ESTIMATE** and must be labelled and explained.

## Trust levels
- **MEASURED** — straight from the feed (lap time, gap, speed at a sample).
- **DERIVED** — computed from measurements by code (pace per lap, braking point from the brake signal and distance, time lost in a corner).
- **ESTIMATE** — a model (tyre life left, undercut odds, rejoin position, "if the race ended now", fuel-corrected pace).

## Pipeline requirements
1. Fetch with retries and polite throttling; cache raw responses in `pipeline/cache/` (gitignored).
2. Join `car_data` with `location` by nearest timestamp per driver; resample by lap distance for traces.
3. Detect and handle gaps, duplicates, pit-lane laps, safety-car laps, in/out laps. Exclude them from pace stats and say so.
4. Write only the files described in `05-DATA-SCHEMA.md`.
5. Record `coverage` flags per race (telemetry, radio, weather, intervals) so the UI can show badges and avoid dead ends.

## Featured races (suggested)
Pick 4–6 races with full coverage and good stories: a wet or mixed race, a safety-car swing, a strategy undercut, a late overtake battle, one Indian-audience favourite. Prefer 2023–2025 for reliability; add the most recent race only if its data is complete.

## Compliance
Respect each source's terms and rate limits. Credit OpenF1 and FastF1 on the Methods page and footer. This is an unofficial fan project; do not use team or F1 logos.
