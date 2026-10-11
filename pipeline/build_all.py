"""Build all featured races (docs/04: 4-6 races). Runs build_race per entry."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Featured races — pinned in docs/DECISIONS.md (full TEL/RADIO/WX/IV coverage).
FEATURED: list[tuple[int, int]] = [
    (2025, 18),  # Singapore — night race, safety-car swing
    (2024, 21),  # São Paulo — wet VER P17→P1 masterclass
    (2024, 12),  # Britain — HAM home win
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
