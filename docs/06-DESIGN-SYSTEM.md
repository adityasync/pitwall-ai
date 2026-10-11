# 06 — Design system ("Pit wall at night")

The canvas screen `DesignSystem.dc.html` is the visual source of truth. This file lists the tokens to put in Tailwind config / CSS variables.

## Principles
Near-black canvas, one cool accent, team colours only ever mean teams. Numbers monospaced so columns line up. Headlines condensed like timing screens. Sharp geometry, tech-noir, premium developer-tool feel.

## Colour tokens
| Token | Hex | Use |
|---|---|---|
| `--bg` | `#09090b` | page |
| `--bar` | `#0c0c0e` | top bars |
| `--panel` | `#111113` | cards |
| `--raised` | `#18181b` | inputs, chips |
| `--border` | `#27272a` | hairlines |
| `--border-strong` | `#3f3f46` | controls |
| `--text` | `#e4e4e7` | text |
| `--muted` | `#8a8a93` | labels (contrast checked on `--bg`) |
| `--accent` | `#2de2e6` | AI, live, primary actions (alt: `#39B54A`, `#FF8000`, `#B14CFF`) |
| `--good` | `#39B54A` | faster, closing, healthy |
| `--warn` | `#ff8c1a` | caution, limited data |
| `--bad` | `#ef4444` | slower, worn, error |
| `--fastest` | `#B14CFF` | purple sector, best lap |
| `--flag` | `#FFF000` | yellow flag, medium tyre |

Team colours (from canvas): Red Bull `#3671C6`, McLaren `#FF8000`, Ferrari `#E8002D`, Mercedes `#27F4D2`, Aston Martin `#229971`, Williams `#64C4FF`, Alpine `#FF87BC`, Audi `#52E252`. Take per-race values from `drivers.json` `teamColour` when present. Team colours never double as status colours.
Tyres: Soft `#DA291C`, Medium `#FFF000`, Hard `#FFFFFF`, Inter `#39B54A`, Wet blue. Circle with a letter (S M H I W); colour is never the only signal.

## Type
- Display and headings: **Barlow Condensed** 600/700 (56 display, 30 heading).
- Body: **Barlow** 400–600, 16 px (Easy mode body is 16–18).
- Data: **JetBrains Mono** 400–700, 13 px for numbers. Panel labels: Mono 11 px, letter-spacing 2px, uppercase, `--muted`.
Load via Google Fonts or `next/font`.

## Components to build (in `/components`)
Button (primary, secondary, quiet), ModeToggle (EASY/PRO), LangToggle (EN/HINGLISH), Chip, TextField, AiCard (headline, 2 sentences, Hinglish line, evidence chips), EvidenceStrip, TrustBadge (MEASURED `#39B54A`, DERIVED `#64C4FF`, ESTIMATE accent), TimingRow (position, team bar, code, gap, trend arrow, tyre circle), GapBar, TyreBars, TrackMap, TraceChart, PlaybackBar (with moment markers), CommandPalette, StateCard (six variants: no live, loading, live off, no radio, thinking, error), TopBar with "REPLAY · LAP n" badge.

## Layout rules
- Desktop canvas width 1440; content max-width 1200–1360, centred. Pro workstation uses a multi-panel grid.
- Mobile 390 px: single column, bottom tab bar (Easy mode), no horizontal scroll, 16 px gutters.
- Panels: 1 px `--border`, radius 6–10 px, no shadows, no gradients except subtle accent glow on the hero.

## Rules for every screen
1. Every number is measured, derived or an estimate, and says which.
2. Team colours mean teams only.
3. The AI quotes computed numbers only and says when data is missing.
4. Touch targets at least 44 px; text contrast at least 4.5:1.
5. Colour is never the only signal: pair with a label, arrow or shape.
6. Hinglish and English use the same layout, so toggling never shifts things.
7. Motion is functional (playback, scrubbing); respect `prefers-reduced-motion`.

## Copy voice
Short, concrete, no hype, no jargon in Easy mode (explain terms in one line). Pro mode may use terms (undercut, delta, apex) with tooltips. Hinglish: natural Roman-script Hindi with English F1 terms; see `07-AI-RULES.md`.
