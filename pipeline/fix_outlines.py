"""One-off repair (2026-10-12): rebuild track.json outlines from ONE clean lap.

Root cause: build_race.py drew the outline from the driver's ENTIRE race
location trace (all laps + pit detours + formation positioning concatenated),
so lap-to-lap jumps rendered as a scribble web. This script re-derives every
race outline locally (no network) from positions.json x/y sliced to the
reference driver's fastest clean lap, using the same moving-average smoother
as the pipeline. Corners / braking zones / sectors are preserved.

Usage:  python pipeline/fix_outlines.py [--race 2023-16-singapore]
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "public" / "data"
OUTLINE_POINTS = 1500
SMOOTH_W = 9


def smooth(xs: np.ndarray, ys: np.ndarray) -> list:
    # Edge-padded moving average: mode="same" zero-pads beyond the ends and
    # drags the first/last points toward (0,0) — a fake detour + long closing
    # segment. Padding with the edge value keeps the lap on track.
    w = max(1, min(SMOOTH_W, len(xs) // 10))
    xs = np.asarray(xs, dtype=float)
    ys = np.asarray(ys, dtype=float)
    if len(xs) > w:
        k = np.ones(w) / w
        p = w // 2
        sx = np.convolve(np.pad(xs, (p, p), mode="edge"), k, mode="valid")
        sy = np.convolve(np.pad(ys, (p, p), mode="edge"), k, mode="valid")
    else:
        sx, sy = xs, ys
    step = max(1, len(sx) // OUTLINE_POINTS)
    ol = [[float(x), float(y)] for x, y in zip(sx[::step], sy[::step])]
    # a lap is a loop — close it so start/finish meet
    if ol:
        ol.append([ol[0][0], ol[0][1]])
    return ol


def norm_shape(x: np.ndarray, y: np.ndarray, n: int = 64) -> np.ndarray:
    """Resample to n evenly-spaced (by index) points, centroid-normalised."""
    idx = np.linspace(0, len(x) - 1, n).astype(int)
    px, py = x[idx] - x.mean(), y[idx] - y.mean()
    s = float(np.hypot(px, py).mean()) or 1.0
    return np.stack([px / s, py / s], axis=1)


def max_gap(x: np.ndarray, y: np.ndarray) -> float:
    """Longest consecutive jump, in track units. A feed blackout (Monaco
    tunnel: no GPS for ~6 s) leaves one long straight interpolation."""
    seg = np.hypot(np.diff(x), np.diff(y))
    return float(seg.max()) if len(seg) else float("inf")


def consensus_pick(segs: list) -> list:
    """Consensus rank (best first) by shape agreement. Glitches are random
    per lap; the true circuit repeats. Systematic gaps (tunnel blackouts)
    appear in every lap, so gap-bridging is handled separately."""
    shapes = [norm_shape(x, y) for x, y in segs]
    scores = []
    for i, a in enumerate(shapes):
        d = np.mean([np.abs(a - b).sum(axis=1).mean() for j, b in enumerate(shapes) if j != i])
        scores.append(float(d))
    return list(np.argsort(scores))


def trim_ends(x: np.ndarray, y: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Drop glitchy samples hanging off either end of the slice (feed
    teleports at lap boundaries). Stops when both end segments look sane."""
    for _ in range(30):
        if len(x) < 30:
            break
        seg = np.hypot(np.diff(x), np.diff(y))
        med = float(np.median(seg))
        if med <= 0:
            break
        if seg[-1] > 8 * med:
            x, y = x[:-1], y[:-1]
            continue
        if seg[0] > 8 * med:
            x, y = x[1:], y[1:]
            continue
        break
    return x, y


def closure_gap(x: np.ndarray, y: np.ndarray) -> float:
    """Start/finish distance as a fraction of total path. A real lap closes."""
    path = float(np.hypot(np.diff(x), np.diff(y)).sum())
    if path <= 0:
        return float("inf")
    return float(np.hypot(x[0] - x[-1], y[0] - y[-1]) / path)


def clean_laps(rows: list) -> list:
    out = []
    for r in rows:
        if not isinstance(r, dict):
            continue
        t, dur = r.get("t"), r.get("time")
        if t is None or not dur:
            continue
        if r.get("pitLane") or r.get("inLap") or r.get("outLap"):
            continue
        if not (60 <= dur <= 200):
            continue
        out.append(r)
    return sorted(out, key=lambda r: r["time"])


def fix_race(rid: str) -> str:
    rd = DATA / rid
    pos = json.loads((rd / "positions.json").read_text(encoding="utf-8"))
    laps = json.loads((rd / "laps.json").read_text(encoding="utf-8"))
    track = json.loads((rd / "track.json").read_text(encoding="utf-8"))
    try:
        meta = json.loads((rd / "meta.json").read_text(encoding="utf-8"))
    except OSError:
        meta = {}
    tele = (meta.get("coverage") or {}).get("telemetryDrivers") or []
    t = np.asarray(pos["t"], dtype=float)
    drivers = pos.get("drivers", {})
    cands = [c for c in tele if c in drivers] + [c for c in drivers if c not in tele]
    cands_segs = []  # (code, lap, x, y, max_gap) trimmed slices, several drivers
    for code in cands:
        rows = laps.get(code) or []
        d = drivers[code]
        x = np.asarray(d.get("x") or [], dtype=float)
        y = np.asarray(d.get("y") or [], dtype=float)
        if len(x) != len(t) or len(x) < 30:
            continue
        for lap in clean_laps(rows)[:4]:
            m = (t >= lap["t"] - 1) & (t <= lap["t"] + lap["time"] + 1)
            m &= ~((x == 0) & (y == 0))
            if int(m.sum()) < 30:
                continue
            lx, ly = trim_ends(x[m], y[m])
            if len(lx) < 30:
                continue
            if closure_gap(lx, ly) > 0.10:  # slice doesn't close — wrong span
                continue
            cands_segs.append((code, lap, lx, ly, max_gap(lx, ly)))
        if len(cands_segs) >= 8:
            break
    if not cands_segs:
        return f"{rid}: NO clean lap found — outline untouched"
    if len(cands_segs) == 1:
        code, lap, lx, ly = cands_segs[0][:4]
    else:
        order = consensus_pick([(a, b) for _, _, a, b, _ in cands_segs])
        # consensus rejects random teleports; among the agreeing laps prefer
        # the smallest data gap (a lap that kept tunnel samples beats one
        # with a long straight interpolation across the blackout)
        pool = order[: max(2, len(order) // 2)]
        pick = min(pool, key=lambda i: cands_segs[i][4])
        code, lap, lx, ly = cands_segs[pick][:4]
    ol = smooth(lx, ly)
    track["outline"] = ol
    xs = [p[0] for p in ol]
    ys = [p[1] for p in ol]
    track["bounds"] = [min(xs), min(ys), max(xs), max(ys)]
    (rd / "track.json").write_text(json.dumps(track), encoding="utf-8")
    return f"{rid}: lap {lap['lap']} of {code} ({len(lx)} pts -> {len(ol)}, maxgap {max_gap(lx, ly):.0f})"


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
    print(f"[pitwall] fixing outlines for {len(ids)} races")
    untouched = 0
    for rid in ids:
        try:
            msg = fix_race(rid)
            print("[pitwall]", msg)
            if "untouched" in msg:
                untouched += 1
        except Exception as e:  # one bad race must not stop the batch
            print(f"[pitwall] {rid}: FAILED ({e})")
    print(f"[pitwall] done, {untouched} untouched")


if __name__ == "__main__":
    sys.exit(main())
