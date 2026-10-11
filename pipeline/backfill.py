"""Backfill helper: build (+quali) many rounds without babysitting.

Usage: python pipeline/backfill.py 2025 1-17 19-24
       python pipeline/backfill.py 2026 1-14 --skip 15

Rounds accept single numbers or A-B ranges. One race failing never stops the
batch — failures are collected and reported at the end for a retry pass.
Logs to pipeline/backfill-<year>.log. check_data runs once at the end.
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PIPE = ROOT / "pipeline"


def parse_rounds(specs: list[str], skip: set[int]) -> list[int]:
    rounds: set[int] = set()
    for spec in specs:
        if "-" in spec:
            a, b = spec.split("-", 1)
            rounds.update(range(int(a), int(b) + 1))
        else:
            rounds.add(int(spec))
    return sorted(rounds - skip)


def run(year: int, rnd: int, log) -> bool:
    # stream child output straight into the log: progress is visible per
    # fetch (~40 lines/race), not in one dump when the race finishes.
    log.write(f"\n===== {year} round {rnd} =====\n")
    log.flush()
    ok = True
    for script in ("build_race.py", "build_quali.py"):
        r = subprocess.run(
            [sys.executable, str(PIPE / script), str(year), str(rnd)],
            cwd=str(ROOT), stdout=log, stderr=subprocess.STDOUT,
            text=True, timeout=7200,
        )
        log.flush()
        if r.returncode != 0:
            if script == "build_quali.py":
                log.write(
                    f"[{script} {year} R{rnd} FAILED rc={r.returncode} "
                    "non-fatal; continuing]\n"
                )
                log.flush()
                continue
            log.write(f"[{script} {year} R{rnd} FAILED rc={r.returncode}]\n")
            log.flush()
            ok = False
            if script == "build_race.py":
                break  # no race files -> quali is pointless
    return ok


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("year", type=int)
    ap.add_argument("rounds", nargs="+", help="numbers or A-B ranges")
    ap.add_argument("--skip", default="", help="comma rounds to skip")
    args = ap.parse_args()
    skip = {int(x) for x in args.skip.split(",") if x.strip()}
    rounds = parse_rounds(args.rounds, skip)
    print(f"[backfill] {args.year}: {len(rounds)} rounds {rounds}", flush=True)

    log_path = PIPE / f"backfill-{args.year}.log"
    failed: list[int] = []
    with open(log_path, "a", encoding="utf-8") as log:
        for rnd in rounds:
            print(f"[backfill] {args.year} R{rnd} ...", flush=True)
            if not run(args.year, rnd, log):
                failed.append(rnd)
        log.write("\n===== check_data =====\n")
        r = subprocess.run(
            [sys.executable, str(PIPE / "check_data.py")],
            cwd=str(ROOT), capture_output=True, text=True,
        )
        log.write(r.stdout + r.stderr)
    print(f"[backfill] {args.year} done. failed={failed or 'none'}", flush=True)
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
