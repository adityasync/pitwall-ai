# 02 — Pages

Canvas file names in brackets. Priority: **P0** build first (days 1–3), **P1** next (day 4), **P2** if time allows (day 5).
Mode: EASY, PRO or BOTH. All pages read the same race files in `public/data/`.

## Marketing and start
| Route | Page | Canvas | Pri | Data |
|---|---|---|---|---|
| `/` | Landing page | Landing.dc.html | P0 | static copy, 2 featured moments |
| `/races` | Pick a race and a mode | Home.dc.html | P0 | `index.json` |
| `/follow` | Follow my driver | Follow.dc.html | P2 | localStorage |
| (all) | Empty, loading, error states | States.dc.html | P0 | none |

## Watch (per race: `/race/[id]/...`)
| Route | Page | Canvas | Pri | Mode | Data |
|---|---|---|---|---|---|
| `/race/[id]/easy` | Easy race view | Easy.dc.html | P0 | EASY | positions, laps, stints, moments |
| `/race/[id]/easy` (<640 px) | Phone layout | Mobile.dc.html | P0 | EASY | same, stacked, bottom tab bar |
| `/race/[id]/pro` | Race workstation | Main.dc.html | P0 | PRO | positions, track, telemetry, stints, moments |
| `/race/[id]/recap` | Recap and share card | Recap.dc.html | P1 | BOTH | results, overtakes, pits, stats |

## Analyse
| Route | Page | Canvas | Pri | Data |
|---|---|---|---|---|
| `/race/[id]/compare` | Compare drivers | Compare.dc.html | P0 | telemetry by distance |
| `/race/[id]/corners` | Corner analysis | Corners.dc.html | P1 | track corners, brake signal, speed |
| `/race/[id]/strategy` | Pit strategy simulator | Strategy.dc.html | P1 | stints, pits, pace model (ESTIMATE) |
| `/race/[id]/pace` | Tyre and pace | Pace.dc.html | P1 | laps, stints, degradation |
| `/race/[id]/battles` | Battles and overtakes | Battles.dc.html | P1 | intervals, overtakes |
| `/telemetry` | Telemetry lab | Telemetry.dc.html | P1 | any laps, any channels, CSV export |
| `/race/[id]/quali` | Qualifying | (not designed yet) | P2 | sector times, ideal lap |

## People and season
| Route | Page | Canvas | Pri | Data |
|---|---|---|---|---|
| `/race/[id]/driver/[code]` | Driver page | Driver.dc.html | P1 | laps, stints, pits, radio |
| `/standings` | Standings, if it ended now | Standings.dc.html | P1 | `championship` (beta) + model |
| `/season` | Season trends | (not designed yet) | P2 | aggregates of every race file |
| `/h2h` | Head to head | (not designed yet) | P2 | teammates, quali and race |

## Tools
| Route | Page | Canvas | Pri | Data |
|---|---|---|---|---|
| `/ask` | Ask the AI | Ask.dc.html | P0 | stats pack + `/api/ask` |
| `/explorer` | Session explorer | Explorer.dc.html | P1 | `index.json` with TEL/RAD/WX coverage badges |
| `/race/[id]/radio` | Radio and race control | Radio.dc.html | P2 | `radio.json`, `race_control.json` (availability varies) |
| `/export` | Chart builder and export | (not designed yet) | P2 | CSV, PNG, share link |
| `/methods` | Data and methods | Methods.dc.html | P1 | static, mirrors `04-DATA-SOURCES.md` |

## Shell (every page)
App shell and command bar (Shell.dc.html): grouped navigation WATCH / ANALYSE / PEOPLE / MORE, `Ctrl-K` command palette, shortcuts bar, Easy/Pro switch top right, EN/Hinglish switch, replay badge ("REPLAY · LAP 42").
Older canvas screens have a flat tab strip; replace it with the shell navigation.

## Shared behaviour
- **Replay clock** is global. Scrubbing on any page updates every panel (see `03-ARCHITECTURE.md`).
- **Selected driver(s)** and **selected moment** are global state and sync across pages and the URL (`?t=1234&d=NOR,VER&m=m_042`).
- **Mode** and **language** persist in localStorage.
- **Race list** shows data badges: REPLAY, REPLAY + RADIO, TEL, WX. Do not offer radio where it does not exist.
- **Deep links:** every moment has a shareable URL; the Recap share card renders from it.

## Minimum viable set (if time collapses)
Landing, Races, Easy, Pro workstation, Compare, Ask, Recap, Methods, States. Everything else is depth.
