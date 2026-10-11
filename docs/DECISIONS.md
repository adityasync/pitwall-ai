# Decisions log

Add one line per decision: date, decision, reason. The agent must append here instead of silently choosing.

| Date | Decision | Reason |
|---|---|---|
| 2026-10-10 | Build F1 (not cricket) | no free live cricket API; FanCode (Dream Sports) holds India F1 rights |
| 2026-10-10 | Replay-first | OpenF1 real-time is paid; historical is free from 2023 |
| 2026-10-10 | Static JSON on Vercel, one `/api/ask` route | avoid sleeping free-tier servers |
| 2026-10-10 | Pre-generate moment explanations | zero latency and cost in the hero flow |
| 2026-10-11 | Landing page at `/`, race picker at `/races` | landing sells, picker works |
| 2026-10-11 | Scaffold: Next 16 + React 19 + Tailwind 4, no src-dir, pnpm | create-next-app defaults; matches /app layout in 03-ARCHITECTURE |
| 2026-10-11 | Fonts: Barlow Condensed / Barlow / JetBrains Mono via next/font | tokens from 06-DESIGN-SYSTEM; Geist replaced |
| 2026-10-11 | Zustand for replay/selection/ui stores | prescribed in 03-ARCHITECTURE |
| 2026-10-11 | OpenF1 primary for everything incl. lap telemetry (no FastF1) | OpenF1 laps/car_data/location verified complete for 2025-18; one source avoids mismatches |
| 2026-10-11 | Day 1 race: 2025-18-singapore (session_key 9896) | full coverage (TEL/RADIO/WX/IV), matches 05-SCHEMA example id |
| 2026-10-11 | Telemetry lap distance via speed integration, not location x/y | location units are not meters (~7 units/m); speed integral validates at 4.85 km vs 4.94 km track |
| 2026-10-11 | Telemetry Day 1: top-3 finishers (RUS/VER/NOR), fastest-3 + every-5th laps | size budget: whole race 0.62 MB gz, Easy 53 KB |
| 2026-10-11 | Canvas copy extracted by decoding pages.html bundle (JS-rendered, no static text) | bundle manifest is gzip+base64 per page; decoded to read copy in order |
| 2026-10-11 | Easy page split: server page.tsx (params+Suspense+static params) + easy-client.tsx | Next 16 blocks client hooks + generateStaticParams in one file |
| 2026-10-11 | Z.ai client speaks OpenAI-compatible /chat/completions; no key = keep templates | exact Z.ai URL/model still to confirm from current docs |
| 2026-10-11 | Tyre health bar = 1 - age/45, ESTIMATE, canvas footnote | honest model until deg-based health lands |
| 2026-10-11 | Audit fixes: arrows step laps via store lapStarts; reduced-motion CSS+scroll gate; WHY? links to Easy; mode cards link first race; d= URL param | Day 1-2 audit vs 08-BUILD-PLAN |
| 2026-10-11 | Eval RUN + Lighthouse + real-phone test deferred to scheduled Day 3/4 slots | need Z.ai key, 3 races, device; question set + script ready |
| 2026-10-11 | Z.ai confirmed: base https://api.z.ai/api/paas/v4, model glm-4.5-flash, OpenAI-compatible /chat/completions (ping 200) | key in .env.local (ignored); .env.example holds placeholders; fixed `ZAI_MODEL==` typo |
| 2026-10-11 | Eval 20/20 pass across 3 races (9 traps refused, numbers/names/comparisons clean, Hinglish Roman-only) | harness mirrors /api/ask pack; Q20 prediction-trap declined without forecasting |
| 2026-10-11 | Pit durations >120 s nulled (red-flag stoppages, e.g. Brazil lap 32) | 1409 s presented as a pit stop in eval Q11 — data bug, fixed + rebuilt |
| 2026-10-11 | Featured 3: 2025-18-singapore, 2024-21-brazil (wet VER P17→P1), 2024-12-british (HAM home win) | full TEL/RADIO/WX/IV coverage each; 0.51–0.62 MB gz |
| 2026-10-11 | Next 16 shells: sync outer page + async Inner in Suspense (params never awaited in shell) | fixes instant-shell-url-data in dev for all 9 race routes |
| 2026-10-11 | Telemetry fetched only for coverage.telemetryDrivers — never probe unknown files | Pro page spammed 404s for ANT/LEC/HAM/ALO |
| 2026-10-11 | P2 built: Radio (clips+RC), Follow (localStorage), Season (aggregates+H2H merged, no separate /h2h), Export, Quali (new build_quali fetch, ideal lap DERIVED) | quali data had to be fetched; everything else read existing files |
| 2026-10-11 | Submission note final: 171 words in SUBMISSION-NOTE.txt | problem + help + AI tools, under 200 |
| 2026-10-11 | Neon Postgres (ap-southeast-1) as /api/ask answer cache ONLY — static CDN stays for files, in-memory stays for rate limits | repeat Q 9806 ms → 401 ms (24x), cached:true flag; no key/no DB = graceful miss; fallbacks never cached |
| 2026-10-11 | Polish pass: normalized TrackMap units per track; high-confidence markers only; keyboard tower rows + corner dots; skip link + focus + themed ranges; scrollable mobile nav; real race strip on landing; /debug removed; flag-moment AI card fix | user: UI feels bad — fixed bugs first, taste second |
| 2026-10-11 | De-hardcoded: lib/config.ts provenance tunables (SPEC/DOMAIN/MODEL) + first-race resolver; server defaults read index.json; static-params fallbacks return []; closing rate uses chaser median not 95; real landing hero card | zero race-id literals in app/; pipeline thresholds centralized; UI list caps stay as presentation defaults |
| 2026-10-11 | Completion: build_all pins 3 races; pytest 4/4; link audit 47 hrefs, 0 dead; explain --all resumable via generated flag (SIN 35/BRA 25/GBR 20 LLM, rest honest templates) | overnight: python pipeline/explain_moments.py <id> --all per race |
| 2026-10-11 | Race pages: one slim RaceBar (name + live lap + 10 tabs) replaces tab strip + Easy/Pro title rows; per-page h1s kept elsewhere, sr-only h1 on Easy/Pro; Pro weather line dropped | user: 3 stacked headers on entry — minimal single band; mode switch now via tabs; weather cut as low-value chrome |
| 2026-10-11 | Logo: Concept C telemetry trace (speed trace + tap-target ring on the moment) as /logo.svg lockup + chunky 16px /favicon.svg; 6 concepts compared on temp /logo-review page, scaffolding deleted | user picked C from 6; trace = "tap a moment, understand why" as a glyph; favicon drops gridlines, thicker strokes |

## Open questions
- Which data source is primary per field (OpenF1 only, or FastF1 for lap telemetry)?
- Which 4–6 races are featured?
- Z.ai model and rate limits — confirm from current docs.
- Which of the two canvas site maps (`Sitemap` vs `SiteMap`) is canonical?
- Quali, Season, Head-to-head and Export screens are not designed yet.
