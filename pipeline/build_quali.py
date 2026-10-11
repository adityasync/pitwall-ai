"""Fetch qualifying laps for a race (docs/02 P2 quali page).

Usage: python pipeline/build_quali.py 2024 21
Resolves (year, round) -> qualifying session of that round's meeting,
writes public/data/<race-id>/quali.json:
  { CODE: { laps: [{lap, time, s1, s2, s3}], best, bestSectors, ideal } }
Ideal lap = sum of personal best sectors (DERIVED — nobody drove it).
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_race import LOCATION_SLUG, fetch, slugify  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
OUT_BASE = ROOT / "public" / "data"
CACHE_BASE = Path(__file__).resolve().parent / "cache"
OPENF1 = "https://api.openf1.org/v1"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("year", type=int)
    ap.add_argument("round", type=int)
    args = ap.parse_args()

    sessions = fetch(
        f"{OPENF1}/sessions?year={args.year}&session_name=Qualifying",
        CACHE_BASE / f"sessions-quali-{args.year}.json",
    )
    sessions = sorted((s for s in sessions if s.get("date_start")), key=lambda s: s["date_start"])
    if args.round < 1 or args.round > len(sessions):
        print(f"[quali] round out of range 1..{len(sessions)}", file=sys.stderr)
        return 2
    # round-index alarm: sprint weekends must not shift quali<->race alignment
    try:
        n_race = len(json.loads((CACHE_BASE / f"sessions-{args.year}.json").read_text(encoding="utf-8")))
        if n_race != len(sessions):
            print(f"[quali] WARNING: {len(sessions)} quali vs {n_race} race sessions — round may misalign")
    except OSError:
        pass
    ses = sessions[args.round - 1]
    sk = ses["session_key"]
    loc = ses["location"]
    slug = LOCATION_SLUG.get(loc, slugify(loc))
    race_id = f"{args.year}-{args.round:02d}-{slug}"
    odir = OUT_BASE / race_id
    if not odir.exists():
        print(f"[quali] {race_id} race files missing — run build_race first", file=sys.stderr)
        return 2
    cdir = CACHE_BASE / race_id

    drivers = fetch(f"{OPENF1}/drivers?session_key={sk}", cdir / "raw_quali_drivers.json")
    laps = fetch(f"{OPENF1}/laps?session_key={sk}", cdir / "raw_quali_laps.json")
    acronym = {d["driver_number"]: d["name_acronym"] for d in drivers}
    print(f"[quali] {race_id}: {len(laps)} laps")

    out: dict[str, dict] = {}
    for r in laps:
        if r.get("is_pit_out_lap") or not r.get("lap_duration"):
            continue
        if r.get("lap_number") is None or r.get("driver_number") is None:
            continue
        code = acronym.get(r["driver_number"], str(r["driver_number"]))
        out.setdefault(code, []).append({
            "lap": r["lap_number"], "time": r["lap_duration"],
            "s1": r.get("duration_sector_1"), "s2": r.get("duration_sector_2"),
            "s3": r.get("duration_sector_3"),
        })
    quali = {}
    for code, ll in out.items():
        ll.sort(key=lambda x: x["lap"])
        times = [x["time"] for x in ll]
        bs = {}
        for k in ("s1", "s2", "s3"):
            vals = [x[k] for x in ll if x.get(k)]
            bs[k] = min(vals) if vals else None
        ideal = round(sum(v for v in bs.values() if v), 3) if all(bs.values()) else None
        quali[code] = {"laps": ll, "best": round(min(times), 3),
                       "bestSectors": {k: (round(v, 3) if v else None) for k, v in bs.items()},
                       "ideal": ideal}
    (odir / "quali.json").write_text(json.dumps(quali), encoding="utf-8")
    print(f"[quali] wrote {odir / 'quali.json'} ({len(quali)} drivers)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
