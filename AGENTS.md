# AGENTS.md — start here

You are building **PITWALL.AI**, a second-screen web app that explains a Formula 1 race: tap a moment, understand why, in English or Hinglish. It is the submission for the Dream11 Forward Deployed Engineer Intern assignment (one AI-powered artifact that solves a real fan problem during a live sports match, plus a note of at most 200 words).

The visual design is already laid out on the Claude design canvas (23 screens). Build to that design. Do not redesign.

## Read in this order
1. `docs/01-PRODUCT.md` — who it is for, the problem, the three ways in, what "done" means
2. `docs/02-PAGES.md` — every page, route, data it needs, mode, priority
3. `docs/03-ARCHITECTURE.md` — stack, folders, replay clock, how data flows
4. `docs/04-DATA-SOURCES.md` — OpenF1 / FastF1 facts and hard limits
5. `docs/05-DATA-SCHEMA.md` — the JSON files the pipeline writes and the UI reads
6. `docs/06-DESIGN-SYSTEM.md` — tokens, components, rules
7. `docs/07-AI-RULES.md` — grounding, prompts, Hinglish, evidence strip
8. `docs/08-BUILD-PLAN.md` — day by day order, P0/P1/P2
9. `docs/09-DEPLOYMENT.md` — Vercel, env vars, caching
10. `docs/10-SUBMISSION.md` — the 200-word note and the demo script

## Non-negotiable rules
- **Replay first.** Live OpenF1 data needs a paid plan. Every screen works from pre-computed historical race files. Live is a clearly labelled optional mode, never a dependency.
- **The AI never invents numbers.** It only quotes values from the computed stats pack. If data is missing it says so. See `07-AI-RULES.md`.
- **Every number carries a trust label:** MEASURED, DERIVED or ESTIMATE.
- **Never promise signals the data does not have:** no brake pressure, steering, ERS, brake bias, tyre temperature or tyre wear. Brake is on/off. Tyre life left, undercut odds and "if the race ended now" are models.
- **Static JSON served from the CDN.** No backend is required at runtime except one `/api/ask` route. Do not depend on a free-tier server that sleeps.
- **Easy and Pro share one dataset.** A toggle changes presentation, not data.
- **44 px touch targets, 4.5:1 contrast, colour never the only signal.**
- **Ship the P0 pages first.** A finished small app beats a half-built large one.

## Commands (create these)
```
pnpm install
pnpm dev                  # Next.js app on :3000
pnpm data:build 2025 18   # run the Python pipeline for one race (year, round)
pnpm data:all             # build the featured races
pnpm test                 # unit tests for stats functions
pnpm lint && pnpm typecheck
```

## Definition of done for any page
- Matches the canvas screen at 1440 px and works down to 390 px.
- Has loading, empty and error states (see the States screen).
- Easy/Pro and EN/Hinglish toggles work where the canvas shows them.
- Every number shows its trust label or sits under a panel that does.
- No console errors, keyboard reachable, replay clock stays in sync.

## When something is unclear
Prefer the canvas, then these docs. If they conflict, the canvas wins for look and layout, these docs win for data and behaviour. Record any decision you make in `docs/DECISIONS.md`.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
