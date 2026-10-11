"""PITWALL.AI data pipeline — one race end to end (docs/04 + 05).

Usage:
    python pipeline/build_race.py 2025 18 [--drivers NOR,VER,PIA] [--telemetry-drivers 3]

Resolves (year, round) -> OpenF1 session, fetches with retries + throttle,
caches raw in pipeline/cache/<race-id>/, writes public/data/<race-id>/*.json
per docs/05-DATA-SCHEMA.md. Missing data stays missing — never invented.
"""

from __future__ import annotations

import argparse
import gzip
import json
import sys
import time
from datetime import datetime
from pathlib import Path

import certifi
import numpy as np
import requests

from compute_stats import compute_stats
from detect_moments import detect_moments

ROOT = Path(__file__).resolve().parent.parent
OUT_BASE = ROOT / "public" / "data"
CACHE_BASE = Path(__file__).resolve().parent / "cache"

OPENF1 = "https://api.openf1.org/v1"
UA = {"User-Agent": "pitwall-ai/0.1 (+unofficial fan project)"}

# Pipeline tunables — one place, no magic numbers below.
FETCH_THROTTLE_S = 1.0  # polite gap between OpenF1 requests (0.35 caused 429s under backfill load)
FETCH_RETRIES = 4
RESAMPLE_M = 10  # docs/05: telemetry every 5–10 m of lap distance
LAP_MIN_M = 3000  # plausible F1 lap length bounds (m, via speed integral)
LAP_MAX_M = 8000
PIT_SUSPICIOUS_S = 120  # longer pit durations are red-flag stoppages, nulled
OUTLINE_POINTS = 1500  # track outline downsample target (smoothed, was 2000 raw)
OUTLINE_SMOOTH = 9  # moving-average window on x/y to kill OpenF1 location jitter
TELEMETRY_KEEP_EVERY = 5  # store every Nth lap + fastest 3 + opening laps
CORNER_SMOOTH = 5  # speed smoothing window (samples, ~1.5 s)
CORNER_PROMINENCE_KMH = 8  # min valley depth vs ±150 m window
CORNER_MIN_GAP_M = 120  # min separation between apexes
CORNER_MAX = 25
BRAKE_ON = 50  # binary brake signal threshold (docs/04: 0 or 100)
BRAKE_RUN_GAP = 3  # max sample gap inside one braking run
BRAKE_MIN_M = 30  # min run length to count as a zone
BRAKE_APEX_LINK_M = 120  # link zone to next corner within this distance

GP_NAME = {
    "United Kingdom": "British",
    "Brazil": "São Paulo",
    "United States": "United States",
}

LOCATION_SLUG = {    "Marina Bay": "singapore",
    "Sakhir": "bahrain",
    "Jeddah": "saudi-arabia",
    "Melbourne": "australia",
    "Suzuka": "japan",
    "Miami": "miami",
    "Miami Gardens": "miami",
    "Imola": "emilia-romagna",
    "Monte Carlo": "monaco",
    "Catalunya": "spain",
    "Barcelona": "spain",
    "Montréal": "canada",
    "Montreal": "canada",
    "Spielberg": "austria",
    "Silverstone": "british",
    "Spa-Francorchamps": "belgium",
    "Budapest": "hungary",
    "Zandvoort": "dutch",
    "Monza": "italian",
    "Baku": "azerbaijan",
    "Austin": "americas",
    "Mexico City": "mexico",
    "São Paulo": "brazil",
    "Interlagos": "brazil",
    "Las Vegas": "las-vegas",
    "Kuala Lumpur": "malaysia",
    "Sepang": "malaysia",
    "Lusail": "qatar",
    "Yas Island": "abu-dhabi",
    "Shanghai": "china",
}


def slugify(s: str) -> str:
    return "".join(c.lower() if c.isalnum() else "-" for c in s).strip("-").replace("--", "-")


def gp_name(ses: dict) -> str:
    """Display GP name. Location overrides country: the feed mislabels the
    Sepang return (country_name='Bahrain' @ Kuala Lumpur)."""
    if (ses.get("location") or "") in ("Kuala Lumpur", "Sepang"):
        return "Malaysian"
    return GP_NAME.get(ses.get("country_name"), ses.get("country_name"))


def fetch(url: str, cache_path: Path | None = None, retries: int = FETCH_RETRIES) -> object:
    if cache_path is not None and cache_path.exists():
        return json.loads(cache_path.read_text(encoding="utf-8"))
    last = None
    for i in range(retries):
        try:
            res = requests.get(url, headers=UA, timeout=60, verify=certifi.where())
            res.raise_for_status()
            data = res.json()
            n = len(data) if isinstance(data, list) else 1
            print(f"[fetch] {url.split('/v1/')[-1]} -> {n} rows", flush=True)
            if cache_path is not None:
                cache_path.parent.mkdir(parents=True, exist_ok=True)
                cache_path.write_text(json.dumps(data), encoding="utf-8")
            time.sleep(FETCH_THROTTLE_S)  # polite throttle
            return data
        except Exception as e:  # noqa: BLE001
            last = e
            wait = 2 * (i + 1)
            try:  # honour the server's own back-off ask on 429
                ra = getattr(getattr(e, "response", None), "headers", {}).get("Retry-After")
                if ra is not None:
                    wait = max(wait, int(ra) + 1)
            except (TypeError, ValueError):
                pass
            print(f"[fetch] retry {i + 1}/{retries} after {wait}s: {url.split('/v1/')[-1]}", flush=True)
            time.sleep(wait)
    raise RuntimeError(f"fetch failed {url}: {last}")


def parse_t(s: str) -> datetime:
    return datetime.fromisoformat(s.replace("Z", "+00:00"))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("year", type=int)
    ap.add_argument("round", type=int)
    ap.add_argument("--drivers", default="")
    ap.add_argument("--telemetry-drivers", type=int, default=3)
    args = ap.parse_args()

    year, rnd = args.year, args.round
    sessions = fetch(f"{OPENF1}/sessions?year={year}&session_name=Race", CACHE_BASE / f"sessions-{year}.json")
    sessions = sorted(sessions, key=lambda s: s["date_start"])
    if rnd < 1 or rnd > len(sessions):
        print(f"[pitwall] round {rnd} out of range (1..{len(sessions)})", file=sys.stderr)
        return 2
    ses = sessions[rnd - 1]
    sk, mk = ses["session_key"], ses["meeting_key"]
    loc = ses["location"]
    slug = LOCATION_SLUG.get(loc, slugify(loc))
    race_id = f"{year}-{rnd:02d}-{slug}"
    print(f"[pitwall] {race_id}: {ses.get('country_name')} GP @ {loc} (session_key={sk})")

    cdir = CACHE_BASE / race_id
    odir = OUT_BASE / race_id
    # clean sweep: a crashed run must never leave stale files behind
    # (e.g. radio.json from different coverage). Cache is separate, so a
    # rebuild stays fast and offline.
    import shutil
    if odir.exists():
        shutil.rmtree(odir)
    odir.mkdir(parents=True, exist_ok=True)
    (odir / "telemetry").mkdir(exist_ok=True)

    def raw(ep: str, extra: str = "") -> object:
        name = ep + ("_" + extra.replace("=", "").replace("&", "_") if extra else "")
        q = f"&{extra}" if extra else ""
        return fetch(f"{OPENF1}/{ep}?session_key={sk}{q}", cdir / f"raw_{name}.json")

    def raw_opt(ep: str, extra: str = "") -> list:
        """Endpoints the race can live without — a flaky feed must never kill
        the whole build. Coverage flags + empty states handle the rest."""
        try:
            data = raw(ep, extra)
            return data if isinstance(data, list) else []
        except RuntimeError as e:
            print(f"[pitwall] {ep} unavailable, degrading: {e}")
            return []

    drivers_raw = raw("drivers")
    laps_raw = raw("laps")
    stints_raw = raw("stints")
    pos_raw = raw("position")
    pit_raw = raw_opt("pit")
    iv_raw = raw_opt("intervals")
    ov_raw = raw_opt("overtakes")
    rc_raw = raw_opt("race_control")
    wx_raw = raw_opt("weather")
    radio_raw = raw_opt("team_radio")
    try:
        champ_d = raw("championship_drivers")
        champ_t = raw("championship_teams")
    except RuntimeError as e:
        print(f"[pitwall] championship beta unavailable: {e}")
        champ_d, champ_t = [], []
    print(f"[pitwall] counts: drivers={len(drivers_raw)} laps={len(laps_raw)} "
          f"stints={len(stints_raw)} pit={len(pit_raw)} pos={len(pos_raw)} iv={len(iv_raw)} "
          f"ov={len(ov_raw)} rc={len(rc_raw)} wx={len(wx_raw)} radio={len(radio_raw)}")

    acronym = {d["driver_number"]: d["name_acronym"] for d in drivers_raw}
    # some races (e.g. wet Brazil 2024) carry null timestamps — drop those rows.
    # Also drop malformed dates: one garbage string must not kill the build.
    def dated(rows, key="date"):
        kept = []
        for r in rows:
            if not r.get(key):
                continue
            try:
                parse_t(r[key])
                kept.append(r)
            except (ValueError, TypeError):
                continue
        if len(kept) != len(rows):
            print(f"[pitwall] dropped {len(rows) - len(kept)} bad-{key} rows")
        return kept

    laps_raw = dated(laps_raw, "date_start")
    laps_raw = [r for r in laps_raw if r.get("lap_number") is not None]
    if not laps_raw:
        print(f"[pitwall] {race_id}: no usable laps — aborting", file=sys.stderr)
        return 2
    stints_raw = [s for s in stints_raw if s.get("lap_start") is not None and s.get("lap_end") is not None]
    pit_raw = dated(pit_raw)
    pos_raw = dated(pos_raw)
    iv_raw = dated(iv_raw)
    ov_raw = dated(ov_raw)
    rc_raw = dated(rc_raw)
    wx_raw = dated(wx_raw)
    radio_raw = dated(radio_raw)
    t0 = min(parse_t(r["date_start"]) for r in laps_raw)

    def rel(dt: str) -> float:
        return (parse_t(dt) - t0).total_seconds()

    # ---- drivers.json ----
    first_pos: dict = {}
    last_pos: dict = {}
    for r in sorted(pos_raw, key=lambda r: r["date"]):
        code = acronym.get(r["driver_number"], str(r["driver_number"]))
        first_pos.setdefault(code, r["position"])
        last_pos[code] = r["position"]
    max_lap = max(r["lap_number"] for r in laps_raw)
    laps_per_driver = {}
    for r in laps_raw:
        laps_per_driver.setdefault(acronym.get(r["driver_number"], "?"), 0)
        laps_per_driver[acronym.get(r["driver_number"], "?")] += 1
    drivers = []
    for d in sorted(drivers_raw, key=lambda d: last_pos.get(d["name_acronym"], 99)):
        code = d["name_acronym"]
        nl = laps_per_driver.get(code, 0)
        drivers.append({
            "code": code,
            "number": d["driver_number"],
            "name": d["full_name"],
            "team": d["team_name"],
            "teamColour": "#" + d["team_colour"].lstrip("#"),
            "grid": first_pos.get(code),
            "finish": last_pos.get(code),
            "status": "FINISHED" if nl >= max_lap - 1 else "DNF",
        })

    # ---- stints + pits ----
    stints: dict[str, list] = {}
    for s in stints_raw:
        code = acronym.get(s["driver_number"], str(s["driver_number"]))
        stints.setdefault(code, []).append({
            "stint": s["stint_number"], "compound": s["compound"],
            "lapStart": s["lap_start"], "lapEnd": s["lap_end"],
            "ageAtStart": s["tyre_age_at_start"],
        })
    for v in stints.values():
        v.sort(key=lambda s: s["stint"])
    pit_laps: dict[str, set] = {}
    pits = []
    for p in pit_raw:
        code = acronym.get(p["driver_number"], str(p["driver_number"]))
        pit_laps.setdefault(code, set()).add(p["lap_number"])
        dur = p.get("pit_duration")
        # red-flag stoppages inflate pit_duration into minutes — don't present
        # those as pit stops (Brazil 2024 showed 1409 s). Keep the lap + time.
        if dur is not None and dur > PIT_SUSPICIOUS_S:
            print(f"[pitwall] suspicious pit duration {dur:.0f}s for {code} lap {p['lap_number']} — nulled")
            dur = None
        pits.append({
            "driver": code, "lap": p["lap_number"], "t": rel(p["date"]),
            "duration": dur, "stationary": p.get("stop_duration"),
        })
    pits.sort(key=lambda p: p["t"])

    # ---- race control flags by lap ----
    flagged_laps: set[int] = set()
    for r in rc_raw:
        flag = (r.get("flag") or "").upper()
        cat = r.get("category") or ""
        if flag in ("YELLOW", "DOUBLE YELLOW", "RED") or "SafetyCar" in cat or cat in ("SafetyCar",):
            if r.get("lap_number"):
                flagged_laps.add(r["lap_number"])

    # ---- compound / tyre age per lap ----
    def compound_at(code: str, lap: int):
        for s in stints.get(code, []):
            if s["lapStart"] <= lap <= s["lapEnd"]:
                return s["compound"], lap - s["lapStart"] + (s["ageAtStart"] or 0)
        return None, None

    # ---- laps.json ----
    laps: dict[str, list] = {}
    for r in laps_raw:
        code = acronym.get(r["driver_number"], str(r["driver_number"]))
        comp, age = compound_at(code, r["lap_number"])
        laps.setdefault(code, []).append({
            "lap": r["lap_number"], "t": rel(r["date_start"]),
            "time": r.get("lap_duration"),
            "s1": r.get("duration_sector_1"), "s2": r.get("duration_sector_2"),
            "s3": r.get("duration_sector_3"),
            "compound": comp, "tyreAge": age,
            "inLap": r["lap_number"] in pit_laps.get(code, set()),
            "outLap": bool(r.get("is_pit_out_lap")),
            "flagged": r["lap_number"] in flagged_laps,
            "pitLane": r["lap_number"] in pit_laps.get(code, set()) or bool(r.get("is_pit_out_lap")),
        })
    for v in laps.values():
        v.sort(key=lambda r: r["lap"])

    # ---- meta.json ----
    lap_starts: dict[int, float] = {}
    for code, ll in laps.items():
        for row in ll:
            if row["lap"] not in lap_starts or row["t"] < lap_starts[row["lap"]]:
                lap_starts[row["lap"]] = row["t"]
    lap_list = [lap_starts[i] for i in sorted(lap_starts)]
    race_end = max((r["t"] + (r["time"] or 0)) for ll in laps.values() for r in ll if r.get("time"))

    # ---- overtakes mapped ----
    overtakes = []
    for o in ov_raw:
        num_to_code = {d["driver_number"]: d["name_acronym"] for d in drivers_raw}
        a = num_to_code.get(o["overtaking_driver_number"], str(o["overtaking_driver_number"]))
        b = num_to_code.get(o["overtaken_driver_number"], str(o["overtaken_driver_number"]))
        t = rel(o["date"])
        lap = _lap_at_t(lap_list, t)
        overtakes.append({"t": t, "lap": lap, "attacker": a, "target": b, "position": o.get("position")})

    # ---- intervals.json (native sampling) ----
    iv_t_all = sorted({rel(r["date"]) for r in iv_raw})
    iv_index = {t: i for i, t in enumerate(iv_t_all)}
    iv_drivers: dict[str, dict] = {}

    def num(v):
        if v is None:
            return None
        try:
            return float(v)
        except (TypeError, ValueError):
            return None

    for r in iv_raw:
        t = rel(r["date"])
        if t < 0 or t > race_end + 1:
            continue  # feed leakage from outside the race window (SEP26: 3 rows at t=-8755 s)
        code = acronym.get(r["driver_number"], str(r["driver_number"]))
        d = iv_drivers.setdefault(code, {"gapLeader": [], "gapAhead": [], "ahead": []})
        # grow lists sparsely then align below
        d.setdefault("_rows", []).append((t, num(r.get("gap_to_leader")), num(r.get("interval")), None))
    # ahead driver resolution needs ordering per timestamp — approximate: leave ahead null,
    # fill from position feed below where possible.
    for code, d in iv_drivers.items():
        rows = sorted(d.pop("_rows"))
        d["gapLeader"] = [g for _, g, _, _ in rows]
        d["gapAhead"] = [g for _, _, g, _ in rows]
        # store per-row t implicitly via global t array? No — store own t per driver:
        d["t"] = [t for t, _, _, _ in rows]
        d["ahead"] = [None for _ in rows]
    intervals = {"t": iv_t_all, "drivers": {k: {"gapLeader": v["gapLeader"], "gapAhead": v["gapAhead"], "ahead": v["ahead"], "t": v["t"]} for k, v in iv_drivers.items()}}

    # ---- positions.json @ 1 Hz forward-filled ----
    end_t = int(race_end) + 1
    t_axis = list(range(0, end_t + 1))
    pos_events: dict[str, list] = {}
    for r in sorted(pos_raw, key=lambda r: r["date"]):
        code = acronym.get(r["driver_number"], str(r["driver_number"]))
        pos_events.setdefault(code, []).append((rel(r["date"]), r["position"]))
    pos_drivers = {}
    for d in drivers:
        code = d["code"]
        evs = pos_events.get(code, [])
        arr = []
        cur = evs[0][1] if evs else None
        j = 0
        for t in t_axis:
            while j < len(evs) and evs[j][0] <= t:
                cur = evs[j][1]
                j += 1
            arr.append(cur)
        pos_drivers[code] = {"pos": arr}
    positions = {"hz": 1, "t": t_axis, "drivers": pos_drivers}

    # resolve 'ahead' driver per intervals row from the position tower
    pos_at = {code: v["pos"] for code, v in pos_drivers.items()}
    for code, series in iv_drivers.items():
        my_pos_at = pos_at.get(code, [])
        ahead_arr = []
        for t, g in zip(series["t"], series["gapAhead"]):
            i = max(0, min(int(t), len(t_axis) - 1))
            mine = my_pos_at[i] if i < len(my_pos_at) else None
            who = None
            if mine and mine > 1:
                for other, arr in pos_at.items():
                    if other != code and i < len(arr) and arr[i] == mine - 1:
                        who = other
                        break
            ahead_arr.append(who)
        series["ahead"] = ahead_arr
    # rebuild intervals with resolved 'ahead' (dict above was built pre-resolution)
    intervals = {"t": iv_t_all, "drivers": {k: {"gapLeader": v["gapLeader"], "gapAhead": v["gapAhead"], "ahead": v["ahead"], "t": v["t"]} for k, v in iv_drivers.items()}}

    # ---- telemetry drivers: top finishers unless overridden ----
    if args.drivers:
        tele_codes = [c.strip().upper() for c in args.drivers.split(",") if c.strip()]
    else:
        tele_codes = [d["code"] for d in drivers[: args.telemetry_drivers]]
    print(f"[pitwall] telemetry drivers: {tele_codes}")
    num_of = {d["code"]: d["number"] for d in drivers}

    # ---- location outline (first telemetry driver) + per-driver telemetry ----
    # One bad driver feed must not kill the race: skip + prune, keep going.
    track_outline = []
    tele_xy: dict[str, tuple] = {}  # code -> (t, x, y) arrays for map (Day 1: tele drivers only)
    ref_geom: dict = {}  # fastest lap geometry of first tele driver (corners/zones)
    outline_done = False
    kept_tele: list[str] = []
    for code in tele_codes:
        num = num_of.get(code)
        if num is None:
            print(f"[pitwall] unknown telemetry code {code} — skipping")
            continue
        try:
            car = raw("car_data", f"driver_number={num}")
            loc = raw("location", f"driver_number={num}")
        except RuntimeError as e:
            print(f"[pitwall] no telemetry for {code}: {e}")
            continue
        if not isinstance(car, list) or not isinstance(loc, list):
            print(f"[pitwall] bad telemetry payload for {code} — skipping")
            continue
        car = sorted(dated(car), key=lambda r: r["date"])
        # drop (0,0) warp rows — they add fake teleport distance; require x/y
        loc = sorted(
            (r for r in dated(loc)
             if r.get("x") is not None and r.get("y") is not None
             and not (r["x"] == 0 and r["y"] == 0)),
            key=lambda r: r["date"],
        )
        if len(car) < 10 or len(loc) < 2:
            print(f"[pitwall] too few samples for {code} (car={len(car)}, loc={len(loc)}) — skipping")
            continue
        loc_t = np.array([rel(r["date"]) for r in loc])
        loc_x = np.array([r["x"] for r in loc], dtype=float)
        loc_y = np.array([r["y"] for r in loc], dtype=float)
        car_t = np.array([rel(r["date"]) for r in car])
        # nearest-location join (two-pointer, both sorted)
        j = 0
        xs = np.zeros(len(car))
        ys = np.zeros(len(car))
        for i, t in enumerate(car_t):
            while j + 1 < len(loc_t) and abs(loc_t[j + 1] - t) <= abs(loc_t[j] - t):
                j += 1
            xs[i], ys[i] = loc_x[j], loc_y[j]
        first = not outline_done
        if first:
            track_outline = _smooth_outline(loc_x, loc_y, OUTLINE_POINTS, OUTLINE_SMOOTH)
            outline_done = True
        tele_xy[code] = (car_t, xs, ys)
        # per-lap resample every 10 m (.get channels: missing key -> NaN -> interpolated)
        tele_laps, ref = _resample_telemetry(code, laps.get(code, []), car_t,
                                        np.array([r.get("speed") for r in car], dtype=float),
                                        np.array([r.get("throttle") for r in car], dtype=float),
                                        np.array([r.get("brake") for r in car], dtype=float),
                                        np.array([r.get("n_gear") for r in car], dtype=float),
                                        np.array([r.get("drs") for r in car], dtype=float), xs, ys,
                                        want_ref=first)
        if ref:
            ref_geom = ref
        (odir / "telemetry" / f"{code}.json").write_text(json.dumps(tele_laps), encoding="utf-8")
        kept_tele.append(code)
    tele_codes = kept_tele
    print(f"[pitwall] telemetry drivers kept: {tele_codes}")

    xs_o = [p[0] for p in track_outline]
    ys_o = [p[1] for p in track_outline]
    corners, braking_zones = _derive_corners(ref_geom)
    # map positions for ALL drivers (not just telemetry): location only,
    # no car_data needed. Tele drivers already have (car_t, xs, ys) above —
    # reuse them, fetch location for the rest so the map shows 20 cars.
    map_xy: dict[str, tuple] = dict(tele_xy)
    for d in drivers:
        code = d["code"]
        if code in map_xy:
            continue
        num = num_of[code]
        try:
            loc = raw("location", f"driver_number={num}")
        except RuntimeError as e:
            print(f"[pitwall] no location for {code}: {e}")
            continue
        loc = sorted(
            (r for r in dated(loc)
             if r.get("x") is not None and r.get("y") is not None
             and not (r["x"] == 0 and r["y"] == 0)),
            key=lambda r: r["date"],
        )
        if len(loc) < 2:
            continue
        lt = np.array([rel(r["date"]) for r in loc])
        lx = np.array([r["x"] for r in loc], dtype=float)
        ly = np.array([r["y"] for r in loc], dtype=float)
        map_xy[code] = (lt, lx, ly)
    # merge 1 Hz map positions for every driver with location (tower-only otherwise)
    for code, (lt, lx, ly) in map_xy.items():
        if code in pos_drivers:
            xi = np.interp(t_axis, lt, lx, left=lx[0], right=lx[-1])
            yi = np.interp(t_axis, lt, ly, left=ly[0], right=ly[-1])
            pos_drivers[code]["x"] = [round(float(v), 1) for v in xi]
            pos_drivers[code]["y"] = [round(float(v), 1) for v in yi]
    n_map = sum(1 for v in pos_drivers.values() if "x" in v)
    print(f"[pitwall] map cars: {n_map}/{len(drivers)}")
    track = {
        "outline": track_outline,
        "bounds": [min(xs_o), min(ys_o), max(xs_o), max(ys_o)] if track_outline else [0, 0, 0, 0],
        "corners": corners,  # DERIVED from speed minima on reference lap
        "brakingZones": braking_zones,  # DERIVED from on/off brake signal
        "sectors": [],
    }

    # ---- weather / race_control / radio ----
    weather = {
        "t": [rel(r["date"]) for r in wx_raw],
        "air": [r.get("air_temperature") for r in wx_raw],
        "track": [r.get("track_temperature") for r in wx_raw],
        "rain": [r.get("rainfall") for r in wx_raw],
        "wind": [r.get("wind_speed") for r in wx_raw],
    }
    race_control = [
        {"t": rel(r["date"]), "lap": r.get("lap_number"), "category": r.get("category"),
         "flag": r.get("flag"), "message": r.get("message")}
        for r in sorted(rc_raw, key=lambda r: r["date"])
    ]
    radio = [
        {"t": rel(r["date"]), "lap": _lap_at_t(lap_list, rel(r["date"])),
         "driver": acronym.get(r["driver_number"], str(r["driver_number"])), "url": r.get("recording_url")}
        for r in sorted(radio_raw, key=lambda r: r["date"])
    ]

    coverage = {
        "telemetry": len(tele_codes) > 0,
        "telemetryDrivers": tele_codes,
        "radio": len(radio) > 0,
        "weather": len(wx_raw) > 0,
        "intervals": len(iv_raw) > 0,
    }
    meta = {
        "id": race_id, "name": f"{gp_name(ses)} Grand Prix",
        "circuit": ses.get("circuit_short_name") or loc,
        "date": ses["date_start"][:10], "laps": max_lap,
        "sessionKey": sk, "startOffset": 0,
        "lapStarts": lap_list, "coverage": coverage,
    }

    ctx = {"laps": laps, "drivers": drivers, "pits": pits, "overtakes": overtakes,
           "race_control": race_control, "intervals": intervals, "stints": stints,
           "lapStarts": lap_list}
    # analysis must never sink the race: ship files without moments before
    # shipping nothing (UI empty-states cover both).
    try:
        moments = detect_moments(ctx)
    except Exception as e:  # noqa: BLE001
        print(f"[pitwall] detect_moments failed, shipping without moments: {e}")
        moments = []
    ctx["moments"] = moments
    try:
        stats = compute_stats(ctx)
    except Exception as e:  # noqa: BLE001
        print(f"[pitwall] compute_stats failed, shipping empty stats: {e}")
        stats = {"pace": {}, "degradation": {}, "undercut": [], "overtakes": [],
                 "fastestLap": {}, "sectorBest": {}, "cornerLoss": []}

    # ---- write ----
    (odir / "meta.json").write_text(json.dumps(meta), encoding="utf-8")
    (odir / "drivers.json").write_text(json.dumps(drivers), encoding="utf-8")
    (odir / "laps.json").write_text(json.dumps(laps), encoding="utf-8")
    (odir / "stints.json").write_text(json.dumps(stints), encoding="utf-8")
    (odir / "pits.json").write_text(json.dumps(pits), encoding="utf-8")
    (odir / "positions.json").write_text(json.dumps(positions), encoding="utf-8")
    (odir / "intervals.json").write_text(json.dumps(intervals), encoding="utf-8")
    (odir / "track.json").write_text(json.dumps(track), encoding="utf-8")
    (odir / "weather.json").write_text(json.dumps(weather), encoding="utf-8")
    (odir / "race_control.json").write_text(json.dumps(race_control), encoding="utf-8")
    if radio:
        (odir / "radio.json").write_text(json.dumps(radio), encoding="utf-8")
    if isinstance(champ_d, list) and champ_d:
        standings = {
            "drivers": [
                {"number": r["driver_number"], "before": r.get("points_start"),
                 "after": r.get("points_current")}
                for r in champ_d
            ],
            "teams": [
                {"team": r["team_name"], "before": r.get("points_start"),
                 "after": r.get("points_current")}
                for r in champ_t
            ] if isinstance(champ_t, list) else [],
        }
        (odir / "standings.json").write_text(json.dumps(standings), encoding="utf-8")
    else:
        (odir / "standings.json").write_text(json.dumps({"drivers": [], "teams": []}), encoding="utf-8")
    (odir / "moments.json").write_text(json.dumps(moments), encoding="utf-8")
    (odir / "stats.json").write_text(json.dumps(stats), encoding="utf-8")
    _update_index(race_id, year, rnd, ses, coverage, moments)

    total = sum(len(gzip.compress(p.read_bytes(), 9)) for p in odir.rglob("*.json"))
    print(f"[pitwall] wrote {odir} ({len(moments)} moments, gz={total/1e6:.2f}MB)")
    return 0


def _lap_at_t(lap_starts: list, t: float) -> int:
    lap = 1
    for i, s in enumerate(lap_starts):
        if s <= t:
            lap = i + 1
        else:
            break
    return lap


def _clean_channel(ch: np.ndarray) -> np.ndarray:
    """Fill NaN samples by linear interpolation between real neighbours.
    2026 (active-aero era) ships null channels — e.g. drs is all-null now
    that DRS is gone. All-NaN -> zeros. Only bridges sub-second gaps
    between MEASURED samples; never invents a signal."""
    ch = np.asarray(ch, dtype=float)
    nans = np.isnan(ch)
    if not nans.any():
        return ch
    good = np.flatnonzero(~nans)
    if len(good) < 2:
        return np.zeros_like(ch)
    ch = ch.copy()
    ch[nans] = np.interp(np.flatnonzero(nans), good, ch[~nans])
    return ch


def _resample_telemetry(code, laps_of_driver, car_t, speed, throttle, brake, gear, drs, xs, ys,
                        want_ref: bool = False):
    """Per lap, resample channels every 10 m of lap distance (docs/05).
    Returns (tele_laps, ref|None) where ref is the fastest lap's raw geometry
    for corner/braking derivation."""
    speed = _clean_channel(speed)
    throttle = _clean_channel(throttle)
    brake = _clean_channel(brake)
    gear = _clean_channel(gear)
    drs = _clean_channel(drs)
    # lap boundaries from laps.json t/time
    bounds = [(r["t"], r["t"] + (r["time"] or 0), r["lap"]) for r in laps_of_driver if r.get("time")]
    by_lap: dict[int, dict] = {}
    raw_laps: dict[int, dict] = {}
    idx = np.searchsorted(car_t, [b[0] for b in bounds])
    spd_ms = speed * (1000.0 / 3600.0)  # km/h -> m/s (MEASURED channel)
    for k, (t0l, t1l, lap) in enumerate(bounds):
        i0 = int(idx[k])
        i1 = int(np.searchsorted(car_t, t1l, side="right"))
        if i1 - i0 < 10:
            continue
        # Lap distance by integrating speed (location units are not meters).
        dt = np.diff(car_t[i0:i1], prepend=car_t[i0])
        dt[(dt <= 0) | (dt > 5)] = 0
        dist = np.cumsum((spd_ms[i0:i1] + np.concatenate([[spd_ms[i0]], spd_ms[i0:i1 - 1]])) / 2 * dt)
        total = dist[-1]
        if not (LAP_MIN_M <= total <= LAP_MAX_M):  # must look like one F1 lap
            continue
        grid = np.arange(0, total, RESAMPLE_M)
        raw_laps[lap] = {
            "dist": dist,
            "speed": speed[i0:i1].astype(float),
            "brake": brake[i0:i1].astype(float),
            "x": xs[i0:i1].astype(float),
            "y": ys[i0:i1].astype(float),
        }
        by_lap[lap] = {
            "dist": [round(float(v), 1) for v in grid],
            "speed": [round(float(v), 1) for v in np.interp(grid, dist, speed[i0:i1])],
            "throttle": [int(v) for v in np.interp(grid, dist, throttle[i0:i1])],
            "brake": [int(v) for v in np.interp(grid, dist, brake[i0:i1])],
            "gear": [int(v) for v in np.interp(grid, dist, gear[i0:i1])],
            "drs": [int(v) for v in np.interp(grid, dist, drs[i0:i1])],
        }
    # keep: fastest 3 + every 5th + (moment laps handled by caller size; keep all, UI lazy-loads)
    times = {r["lap"]: r["time"] for r in laps_of_driver if r.get("time") and not r.get("pitLane")}
    if not by_lap:
        return {"lap": {}}, None
    ranked = sorted(times, key=lambda l: times[l])[:3]
    keep = {lap for lap in by_lap if lap in ranked or lap % TELEMETRY_KEEP_EVERY == 0 or lap <= 2}
    ref = None
    if want_ref and ranked and ranked[0] in raw_laps:
        ref = raw_laps[ranked[0]]
    return {"lap": {str(lap): by_lap[lap] for lap in sorted(keep) if lap in by_lap}}, ref


def _smooth_outline(loc_x, loc_y, target: int, window: int) -> list:
    """Moving-average x/y then stride to target points.
    Kills OpenF1 location jitter so the SVG reads as one clean ribbon."""
    import numpy as _np
    w = max(1, int(window))
    if len(loc_x) > w:
        k = _np.ones(w) / w
        sx = _np.convolve(_np.asarray(loc_x, dtype=float), k, mode="same")
        sy = _np.convolve(_np.asarray(loc_y, dtype=float), k, mode="same")
    else:
        sx, sy = loc_x, loc_y
    step = max(1, len(sx) // target)
    return [[float(x), float(y)] for x, y in zip(sx[::step], sy[::step])]


def _derive_corners(ref: dict) -> tuple[list, list]:
    """Corners from speed minima + braking zones from the on/off brake signal
    on the reference (fastest) lap. All DERIVED. Brake is binary (docs/04)."""
    if not ref:
        return [], []
    dist = np.asarray(ref["dist"], dtype=float)
    speed = np.asarray(ref["speed"], dtype=float)
    brake = np.asarray(ref["brake"], dtype=float)
    xs = np.asarray(ref["x"], dtype=float)
    ys = np.asarray(ref["y"], dtype=float)
    # smooth speed (~5 samples ≈ 1.5 s)
    k = np.ones(CORNER_SMOOTH) / CORNER_SMOOTH
    sm = np.convolve(speed, k, mode="same")
    n = len(sm)
    # local minima (plateau-tolerant), then prominence within ±150 m
    apexes = []
    i = 5
    while i < n - 5:
        if sm[i] == sm[i - 5:i + 6].min():
            lo = int(np.searchsorted(dist, dist[i] - 150, side="left"))
            hi = int(np.searchsorted(dist, dist[i] + 150, side="right"))
            prom = sm[lo:hi].max() - sm[i]
            if prom >= CORNER_PROMINENCE_KMH and (not apexes or dist[i] - apexes[-1][0] > CORNER_MIN_GAP_M):
                apexes.append((float(dist[i]), i))
            # skip past this valley
            j = i + 1
            while j < n - 5 and sm[j] <= sm[i] + 2:
                j += 1
            i = max(j, i + 1)
        else:
            i += 1
    corners = []
    for num, (d, i) in enumerate(apexes[:CORNER_MAX], 1):
        corners.append({"n": num, "x": float(xs[i]), "y": float(ys[i]),
                        "dist": round(d, 1), "name": f"Turn {num}"})
    # braking zones: brake-on runs ending near an apex (or any run > 30 m)
    zones = []
    on = np.where(brake >= BRAKE_ON)[0]
    if len(on):
        runs = np.split(on, np.where(np.diff(on) > BRAKE_RUN_GAP)[0] + 1)
        for run in runs:
            d0, d1 = float(dist[run[0]]), float(dist[run[-1]])
            if d1 - d0 < BRAKE_MIN_M:
                continue
            nxt = next((c["n"] for c in corners if c["dist"] >= d1 - BRAKE_APEX_LINK_M), None)
            if nxt is None and corners:
                nxt = corners[0]["n"]
            zones.append({"corner": nxt, "startDist": round(d0, 1),
                          "endDist": round(d1, 1), "trust": "DERIVED"})
    return corners, zones


def _update_index(race_id, year, rnd, ses, coverage, moments):
    idx_path = OUT_BASE / "index.json"
    idx = {"seasons": [], "races": []}
    if idx_path.exists():
        idx = json.loads(idx_path.read_text(encoding="utf-8"))
    stories = [m["headline"] for m in moments if m["type"] in ("overtake", "flag") and m["confidence"] == "high"][:2]
    cname = gp_name(ses)
    entry = {
        "id": race_id, "year": year, "round": rnd,
        "name": f"{cname} Grand Prix",
        "circuit": ses.get("circuit_short_name") or ses.get("location"),
        "date": ses["date_start"][:10],
        "coverage": coverage, "featured": True,
        "story": "; ".join(stories) if stories else "Replay",
    }
    idx["races"] = [r for r in idx["races"] if r["id"] != race_id] + [entry]
    idx["races"].sort(key=lambda r: (r["year"], r["round"]))
    idx["seasons"] = sorted({r["year"] for r in idx["races"]}, reverse=True)
    idx_path.write_text(json.dumps(idx, indent=1), encoding="utf-8")


if __name__ == "__main__":
    raise SystemExit(main())
