# 08 — Build plan

Deadline: 5 days from 10 Oct 2026, so **15 Oct 2026**. Aim to submit by the evening of **14 Oct** and keep 15 Oct as buffer. Today is 11 Oct, so there are four build days and one polish/submit day.

## Order of work
Pipeline before UI. The UI is only as good as `moments.json` and `stats.json`.

### Day 1 (Sun 11 Oct) — data and skeleton
- [ ] Repo, Next.js, Tailwind tokens, fonts, folder layout.
- [ ] Pipeline for ONE race end to end: `meta, drivers, laps, stints, pits, positions, intervals, track, telemetry` for 2–3 drivers.
- [ ] `detect_moments.py` (overtakes, pits, gap changes, flags, fastest lap) and `compute_stats.py`.
- [ ] `lib/data.ts`, replay clock and stores. A debug page proving the clock drives a list.
- [ ] Shell: TopBar, language toggle, replay badge.
Exit: scrub a timeline and see positions change from real data.

### Day 2 (Mon 12 Oct) — hero flow (P0)
- [ ] Landing page (from `Landing.dc.html`), Races page (`Home`).
- [ ] Easy race view: tower, tyre health, moment feed, tap → AI card with evidence.
- [ ] `explain_moments.py`: generate en + Hinglish, easy + pro explanations with validation.
- [ ] Mobile layout of Easy.
- [ ] States components.
Exit: the whole hero flow works for one race on a phone.

### Day 3 (Tue 13 Oct) — Pro and Ask (P0)
- [ ] Pro workstation: timing tower, track map with braking zones, driver tiles, tyre bars, playback bar with markers, AI feed.
- [ ] Compare page (traces, delta, cursor readout).
- [ ] `/api/ask` with context pack, validation, rate limit; Ask page.
- [ ] Run the pipeline for 4–6 featured races; `index.json`.
- [ ] Recap page and share card.
Exit: all P0 done on three or more races. Deploy to Vercel (preview URL).

### Day 4 (Wed 14 Oct) — depth (P1) and submit candidate
- [ ] Corners, Strategy, Pace, Battles, Driver, Standings, Explorer, Telemetry lab, Methods.
- [ ] Replace flat nav with the Shell navigation and command palette.
- [ ] AI evaluation set, fix failures.
- [ ] Write the submission note and record a 2-minute demo.
- [ ] Production deploy, test on a real phone and a slow connection.
Exit: submit-ready. Submit tonight if stable.

### Day 5 (Thu 15 Oct) — buffer
- [ ] P2 pages only if everything else is solid: Quali, Season, H2H, Export, Radio, Follow.
- [ ] Bug bash, README, final link check, submit with the note.

## What to cut first if behind
Cut P2, then Telemetry lab, then Standings, then Radio. Never cut: Easy mode, Pro workstation, Compare, Ask, Recap, Methods, States, and the evidence strip.

## Quality gates (every day)
- `pnpm typecheck && pnpm lint && pnpm test` clean.
- No invented numbers in any AI output (run the eval).
- Lighthouse mobile performance above 80 on Easy.
- Works with radio missing, telemetry partial and the AI down.

## Risks
| Risk | Mitigation |
|---|---|
| OpenF1 rate limits or gaps | cache raw data, retry, pick races with full coverage, fall back to FastF1 |
| Z.ai rate limits | pre-generate moment explanations; only Ask is live; template fallback |
| Scope creep | P0/P1/P2 list above; one owner for decisions |
| Telemetry file size | per-driver files, lazy load, sample laps only |
| Live demo fails | the demo is replay; live is a labelled optional mode |
