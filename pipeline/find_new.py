"""Find OpenF1 race sessions missing from public/data/index.json.

Usage: python pipeline/find_new.py [--max-new 2]
Prints "YEAR ROUND" lines (newest first) for the scheduled ingest workflow.
Same round resolution + slug logic as build_race (single source of truth).
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
    args = ap.parse_args()

    idx_path = ROOT / "public" / "data" / "index.json"
    have = set()
    years: set[int] = set()
    if idx_path.exists():
        idx = json.loads(idx_path.read_text(encoding="utf-8"))
        have = {r["id"] for r in idx.get("races", [])}
        years = set(idx.get("seasons", []))
    years.add(2026)  # current season even before anything is built

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
