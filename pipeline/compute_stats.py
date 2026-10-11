"""Compute stats.json — facts the AI and pages may quote (docs/05).

Trust: MEASURED straight from feed, DERIVED computed by code,
ESTIMATE a model. Pit / SC / in-out laps excluded from pace stats.
"""

from __future__ import annotations


def compute_stats(ctx: dict) -> dict:
    laps: dict = ctx.get("laps", {})
    stints: dict = ctx.get("stints", {})

    pace: dict = {}
    sector_best: dict = {}
    fastest_lap = None
    degradation: dict = {}

    for code, ll in laps.items():
        clean = [r["time"] for r in ll if r.get("time") and not r.get("pitLane") and not r.get("flagged")]
        if clean:
            s = sorted(clean)
            mid = s[len(s) // 2] if len(s) % 2 == 1 else (s[len(s) // 2 - 1] + s[len(s) // 2]) / 2
            pace[code] = {"median": round(mid, 3), "bestLap": round(min(clean), 3), "trust": "DERIVED"}
            if fastest_lap is None or min(clean) < fastest_lap["time"]:
                lap_no = next(r["lap"] for r in ll if r.get("time") == min(clean))
                fastest_lap = {"driver": code, "lap": lap_no, "time": round(min(clean), 3)}
        # sector bests (MEASURED)
        for i, key in (("s1", 1), ("s2", 2), ("s3", 3)):
            vals = [r[key] for r in ll if r.get(key) and not r.get("pitLane")]
            if vals:
                sector_best.setdefault(code, {})[f"s{i}"] = round(min(vals), 3)
        # degradation per stint: linear slope of clean lap times (ESTIMATE)
        for st in stints.get(code, []):
            seg = [
                r for r in ll
                if st["lapStart"] <= r["lap"] <= st["lapEnd"] and r.get("time")
                and not r.get("pitLane") and not r.get("flagged")
            ]
            if len(seg) >= 5:
                xs = [r["lap"] for r in seg]
                ys = [r["time"] for r in seg]
                n = len(xs)
                mx, my = sum(xs) / n, sum(ys) / n
                den = sum((x - mx) ** 2 for x in xs)
                slope = sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / den if den else 0.0
                degradation.setdefault(code, {})[f"stint{st['stint']}"] = {
                    "slopeSPerLap": round(slope, 4),
                    "laps": n,
                    "trust": "ESTIMATE",
                }

    overtakes = [
        {"t": m["t"], "lap": m["lap"], "drivers": m["drivers"]}
        for m in ctx.get("moments", [])
        if m["type"] == "overtake"
    ]

    return {
        "pace": pace,
        "degradation": degradation,
        "undercut": [],  # model lands with strategy page (Day 4)
        "overtakes": overtakes,
        "fastestLap": fastest_lap or {},
        "sectorBest": sector_best,
        "cornerLoss": [],  # needs braking-zone model (Day 3+)
    }
