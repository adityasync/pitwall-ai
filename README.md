# PITWALL.AI

**Watch the race. Understand the race.**

A second-screen companion for Formula 1. Tap any overtake, pit stop or gap change and get a plain explanation backed by real lap data, in English or Hinglish. Beginners get Easy mode. Devoted fans and analysts get a full Pro workstation.

- Built for the Dream11 Forward Deployed Engineer Intern assignment.
- Data: OpenF1 and FastF1 (free historical data from 2023 onwards).
- AI: Z.ai API, grounded in code-computed stats only.
- Stack: Next.js, Tailwind, Python data pipeline, Vercel.

See `AGENTS.md` for the reading order and `docs/` for the full spec.

## Quick start

```bash
pnpm install
pnpm dev                  # app on :3000
```

Copy `.env.example` to `.env.local` and set `ZAI_API_KEY` / `ZAI_MODEL`
for AI explanations and chat. Without a key the app runs on pre-written
template explanations and honest fallbacks. Set `DATABASE_URL` (Neon
Postgres) to cache Ask answers — repeat questions answer in ~0.4 s instead
of ~10 s; the app works without it.

## Data pipeline

```bash
pnpm data:build 2025 18   # one race (year, round) -> public/data/<race-id>/
pnpm data:quali 2024 21   # qualifying laps for a built race
pnpm data:all             # featured races (see pipeline/build_all.py)
pnpm data:history         # Ergast CSVs (data/*.csv) -> public/data/history/
pnpm data:check           # size budgets: <8 MB/race gz, <400 KB Easy-first
```

Raw API responses cache in `pipeline/cache/` (gitignored). Three replays ship:
`2025-18-singapore`, `2024-21-brazil`, `2024-12-british` — each with full
telemetry, radio, weather and intervals coverage.

## Checks

```bash
pnpm test                 # vitest: stats, clock, AI validators
pnpm lint && pnpm typecheck
python pipeline/eval/run_eval.py http://localhost:3000   # 20-Q honesty eval (needs dev server)
```

## Deploy

Vercel: `vercel --prod`, with `ZAI_API_KEY`, `ZAI_BASE_URL`, `ZAI_MODEL` set
in project env (plus `DATABASE_URL` for the Ask cache). `public/data/**`
ships immutable-cache headers (see `next.config.ts`). No backend required
except `/api/ask`.

## Status

Replay mode works for the featured races. Live mode needs a paid OpenF1 plan and is shown as switched off.

## Licence and data notes

Race data comes from OpenF1 and FastF1 under their terms. This is an unofficial fan project and is not affiliated with Formula 1, the FIA or any team. Team names and colours are used for identification only.
