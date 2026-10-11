"""Enforce docs/05 size budget: <8MB gzipped per race, <400KB before Easy paint."""

from __future__ import annotations

import gzip
from pathlib import Path

# Budgets from docs/05-DATA-SCHEMA.md — change the doc first, then these.
TOTAL_BUDGET_B = 8_000_000
EASY_BUDGET_B = 400_000

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "public" / "data"

EASY_FILES = ["meta.json", "drivers.json", "laps.json", "stints.json", "pits.json", "moments.json", "stats.json"]


def gz_size(p: Path) -> int:
    return len(gzip.compress(p.read_bytes(), compresslevel=9))


if __name__ == "__main__":
    total_ok = True
    for race_dir in sorted(p for p in DATA.iterdir() if p.is_dir()):
        total = sum(gz_size(f) for f in race_dir.rglob("*.json"))
        easy = sum(gz_size(race_dir / f) for f in EASY_FILES if (race_dir / f).exists())
        print(f"[check] {race_dir.name}: total={total/1e6:.2f}MB easy={easy/1e3:.0f}KB")
        if total > TOTAL_BUDGET_B:
            print(f"  FAIL: over 8MB budget")
            total_ok = False
        if easy > EASY_BUDGET_B:
            print(f"  WARN: Easy first paint over 400KB")
    raise SystemExit(0 if total_ok else 1)
