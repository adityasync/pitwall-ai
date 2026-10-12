"""Find OpenF1 race sessions missing from public/data/index.json.

Usage: python pipeline/find_new.py [--max-new 2]
       python pipeline/find_new.py --quali-gaps
Prints "YEAR ROUND" lines (newest first) for the scheduled ingest workflow.
Same round resolution + slug logic as build_race (single source of truth).
--quali-gaps instead lists indexed races whose quali.json never landed
(e.g. Baku 2025: session exists, laps missing upstream) so the workflow can
retry just the quali fetch instead of rebuilding the whole race.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_race import LOCATION_SLUG, fetch, slugify  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
CACHE_BASE = Path(__file__).resolve().parent / "cache"
OPENF1 = "https://api.openf1.org/v1"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--max-new", type=int, default=2)
    ap.add_argument("--quali-gaps", action="store_true",
                    help="list indexed races missing quali.json (retry list)")
    args = ap.parse_args()

    idx_path = ROOT / "public" / "data" / "index.json"
    have = set()
    years: set[int] = set()
    by_id: dict[str, dict] = {}
    if idx_path.exists():
        idx = json.loads(idx_path.read_text(encoding="utf-8"))
        have = {r["id"] for r in idx.get("races", [])}
        by_id = {r["id"]: r for r in idx.get("races", [])}
        years = set(idx.get("seasons", []))
    years.add(2026)  # current season even before anything is built

    if args.quali_gaps:
        missing_q = [(r["year"], r["round"], rid) for rid, r in by_id.items()
                     if not (ROOT / "public" / "data" / rid / "quali.json").exists()]
        for year, rnd, _rid in sorted(missing_q, reverse=True):
            print(f"{year} {rnd}")
        return 0

    missing: list[tuple[int, int, str]] = []
    for year in sorted(years):
        try:
            sessions = fetch(
                f"{OPENF1}/sessions?year={year}&session_name=Race",
                CACHE_BASE / f"sessions-{year}.json",
            )
        except RuntimeError as e:
            print(f"[find-new] {year}: {e}", file=sys.stderr)
            continue
        sessions = sorted(sessions, key=lambda s: s["date_start"])
        for i, ses in enumerate(sessions):
            rnd = i + 1
            slug = LOCATION_SLUG.get(ses["location"], slugify(ses["location"]))
            race_id = f"{year}-{rnd:02d}-{slug}"
            if race_id not in have:
                # skip future sessions (date_start in the future)
                if ses["date_start"][:10] > __import__("datetime").date.today().isoformat():
                    continue
                missing.append((year, rnd, race_id))
    for year, rnd, _rid in sorted(missing, reverse=True)[: args.max_new]:
        print(f"{year} {rnd}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
