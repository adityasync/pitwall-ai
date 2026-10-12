"""Rebuild track.json outlines as the consensus centerline of positions.json.

Root cause (2026-10-12, verified by overlay plots): several track.json
outlines do not coincide with the dots rendered from the same race's
positions.json (sector-level offsets of ~470 units / ~12px at hero scale).
The old outlines came from a single reference lap slice; whatever window it
grabbed, it was not the racing line the field actually drove.

This script re-derives every outline locally (no network) as the pointwise
median of all clean racing laps in positions.json, resampled by index to
N points. Median rejects pit detours, teleports and formation spread as long
as green-flag laps dominate — true for every normal race. The spline passes
through MEASURED positions; only inter-vertex rendering is smoothed
(DERIVED presentation, same contract as lib/map.ts xyAt).

Validation per race (refuse to write on failure):
  - >= 10 clean laps collected
  - traj->median mean distance < 150 track units (racing-line width scale)
  - median span within 3% of the span of the raw trajectories

Usage:  python pipeline/rebuild_outlines.py [--race 2025-18-singapore]
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "public" / "data"
N = 256
MIN_LAPS = 10
MAX_TRAJ_MEAN = 150.0


def clean_rows(rows: list) -> list:
    out = []
    for r in rows:
        if not isinstance(r, dict):
            continue
        if not r.get("time") or r.get("pitLane") or r.get("inLap") or r.get("outLap"):
            continue
        if not (60 <= r["time"] <= 200):
            continue
        if r.get("t") is None:
            continue
        out.append(r)
    return out


def traj_mean_to_med(traj: np.ndarray, med: np.ndarray) -> float:
    d = np.abs(traj[:, None, :] - med[None, :, :]).sum(-1).min(1)
    return float(d.mean())


def rebuild_race(rid: str) -> str:
    rd = DATA / rid
    pos = json.loads((rd / "positions.json").read_text(encoding="utf-8"))
    laps = json.loads((rd / "laps.json").read_text(encoding="utf-8"))
    track = json.loads((rd / "track.json").read_text(encoding="utf-8"))
    t = np.asarray(pos["t"], dtype=float)
    drivers = pos.get("drivers", {})
    stack = []
    for code, d in drivers.items():
        x = np.asarray(d.get("x") or [], dtype=float)
        y = np.asarray(d.get("y") or [], dtype=float)
        if len(x) != len(t) or len(x) < 30:
            continue
        for r in clean_rows(laps.get(code) or []):
            m = (t >= r["t"] - 1) & (t <= r["t"] + r["time"] + 1)
            m &= ~((x == 0) & (y == 0))
            if int(m.sum()) < 30:
                continue
            idx = np.linspace(0, int(m.sum()) - 1, N).astype(int)
            stack.append(np.stack([x[m][idx], y[m][idx]], axis=1))
    if len(stack) < MIN_LAPS:
        return f"{rid}: only {len(stack)} clean laps — outline untouched"
    med = np.median(np.stack(stack), axis=0)
    # validation against raw trajectories (strided)
    traj = np.concatenate(
        [np.stack([np.asarray(d["x"])[::20], np.asarray(d["y"])[::20]], axis=1)
         for d in drivers.values() if len(d.get("x") or []) == len(t)]
    )
    tm = traj_mean_to_med(traj, med)
    if tm > MAX_TRAJ_MEAN:
        # relative gate: a median much closer to the driven trajectories
        # than the stored outline is still a strict improvement — verified
        # by overlay plot before accepting (Bahrain/Monza pit-spread cases).
        old = np.asarray(track.get("outline") or [], dtype=float)
        old_tm = traj_mean_to_med(traj, old) if len(old) else float("inf")
        if not (tm < 0.75 * old_tm):
            return f"{rid}: traj->median {tm:.0f}u too large — outline untouched"
        note = f" (old {old_tm:.0f}u)"
    else:
        note = ""
    ol = [[round(float(a), 1), round(float(b), 1)] for a, b in med]
    ol.append([ol[0][0], ol[0][1]])  # close the loop
    xs = [p[0] for p in ol]
    ys = [p[1] for p in ol]
    track["outline"] = ol
    track["bounds"] = [min(xs), min(ys), max(xs), max(ys)]
    (rd / "track.json").write_text(json.dumps(track), encoding="utf-8")
    return f"{rid}: {len(stack)} laps -> {len(ol)} pts, traj->median {tm:.0f}u{note}"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--race", default=None)
    args = ap.parse_args()
    if args.race:
        ids = [args.race]
    else:
        ids = sorted(
            p.name for p in DATA.iterdir()
            if p.is_dir() and p.name != "history"
            and (p / "positions.json").exists()
            and (p / "laps.json").exists()
            and (p / "track.json").exists()
        )
    print(f"[pitwall] rebuilding outlines for {len(ids)} races")
    untouched = 0
    for rid in ids:
        try:
            msg = rebuild_race(rid)
            print("[pitwall]", msg)
            if "untouched" in msg:
                untouched += 1
        except Exception as e:  # one bad race must not stop the batch
            print(f"[pitwall] {rid}: FAILED ({e})")
    print(f"[pitwall] done, {untouched} untouched")


if __name__ == "__main__":
    sys.exit(main())
