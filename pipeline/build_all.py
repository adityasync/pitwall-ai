"""Build all featured races (docs/04: 4-6 races). Runs build_race per entry."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Featured races — pinned in docs/DECISIONS.md (full TEL/RADIO/WX/IV coverage).
FEATURED: list[tuple[int, int]] = [
    (2023, 16),  # Singapore — Sainz tactical masterclass, only non-RBR win
    (2023, 22),  # Las Vegas — inaugural night race, overtake fest (341 ov)
    (2024, 6),  # Miami — Norris maiden win, safety-car swing
    (2024, 12),  # Britain — HAM home win
    (2024, 21),  # São Paulo — wet VER P17→P1 masterclass
    (2025, 18),  # Singapore — night race, safety-car swing
    (2026, 18),  # Malaysia — Sepang return, 989 moments (interval-filter race)
    (2026, 19),  # Singapore — fresh: built <24h after the flag (NaN fix race)
]

if __name__ == "__main__":
    if not FEATURED:
        print("[pitwall] no featured races pinned yet — see docs/DECISIONS.md")
        raise SystemExit(0)
    for year, rnd in FEATURED:
        r = subprocess.run(
            [sys.executable, str(ROOT / "pipeline" / "build_race.py"), str(year), str(rnd)]
        )
        if r.returncode != 0:
            raise SystemExit(r.returncode)
