"""Detect moments (overtakes, pits, gap changes, flags, fastest lap).

Operates on transformed structures (docs/05-DATA-SCHEMA.md shapes).
Every number in evidence comes from the data — never invented.
"""

from __future__ import annotations

# Moment thresholds — one place. Gap seconds are DOMAIN (DRS needs <1 s);
# counts are MODEL choices about feed density.
OVERTAKE_TOP_N = 6  # high confidence at the sharp end
OVERTAKE_MID_N = 10  # medium to P10, low behind
GAP_CLOSE_S = 1.0  # a closing car starts under a second
GAP_SUSTAIN_S = 1.5  # ...and stays under this while the battle lives
GAP_MIN_SAMPLES = 3  # ...for at least this many interval samples
HEADLINE_MAX = 120


def _ev(label: str, value: str, trust: str) -> dict:
    return {"label": label, "value": value, "trust": trust}


def detect_moments(ctx: dict) -> list[dict]:
    """ctx keys: laps, drivers, pits, overtakes, race_control, intervals,
    acronym (driver_number->code), t0 handled by caller (t already relative).
    Returns moments sorted by t with template explanations (Z.ai Day 2).
    """
    moments: list[dict] = []
    laps: dict = ctx.get("laps", {})
    overtakes: list = ctx.get("overtakes", [])
    pits: list = ctx.get("pits", [])
    race_control: list = ctx.get("race_control", [])
    intervals: dict = ctx.get("intervals", {})
    stints: dict = ctx.get("stints", {})

    n = 0

    def nid() -> str:
        nonlocal n
        n += 1
        return f"m_{n:03d}"

    # --- Overtakes (MEASURED, from /overtakes feed) ---
    for ov in overtakes:
        pos = ov.get("position")
        conf = "high" if (pos or 99) <= OVERTAKE_TOP_N else ("medium" if (pos or 99) <= OVERTAKE_MID_N else "low")
        a, b = ov.get("attacker"), ov.get("target")
        lap = ov.get("lap")
        moments.append(
            {
                "id": nid(),
                "t": ov["t"],
                "lap": lap,
                "type": "overtake",
                "drivers": [a, b],
                "headline": f"{a} passes {b} for P{pos}",
                "evidence": [
                    _ev("Position", f"P{pos}", "MEASURED"),
                    _ev("Lap", str(lap), "MEASURED"),
                ],
                "explain": _template_overtake(a, b, pos, lap),
                "confidence": conf,
                "links": {"page": "compare", "params": {"d": f"{a},{b}", "lap": lap}},
            }
        )

    # --- Pit stops (MEASURED) ---
    for p in pits:
        d, lap = p["driver"], p["lap"]
        dur = p.get("duration")
        ev = [_ev("Pit lap", str(lap), "MEASURED")]
        if dur:
            ev.append(_ev("Pit duration", f"{dur:.1f} s", "MEASURED"))
        moments.append(
            {
                "id": nid(),
                "t": p["t"],
                "lap": lap,
                "type": "pit",
                "drivers": [d],
                "headline": f"{d} pits on lap {lap}",
                "evidence": ev,
                "explain": _template_pit(d, lap, dur),
                "confidence": "high",
                "links": {"page": "strategy", "params": {"d": d, "lap": lap}},
            }
        )

    # --- Flags / safety car (MEASURED) ---
    for rc in race_control:
        flag = (rc.get("flag") or "").upper()
        cat = (rc.get("category") or "")
        if flag in ("YELLOW", "DOUBLE YELLOW", "RED") or "SafetyCar" in cat or "SC" in cat.split():
            if flag == "GREEN" or "Clear" in (rc.get("message") or ""):
                continue
            moments.append(
                {
                    "id": nid(),
                    "t": rc["t"],
                    "lap": rc.get("lap"),
                    "type": "flag",
                    "drivers": [],
                    "headline": f"{flag or cat} — lap {rc.get('lap')}",
                    "evidence": [
                        _ev("Flag", flag or cat, "MEASURED"),
                        _ev("Message", (rc.get("message") or "")[:120], "MEASURED"),
                    ],
                    "explain": _template_flag(flag or cat, rc.get("lap")),
                    "confidence": "medium",
                    "links": {"page": "battles", "params": {"lap": rc.get("lap")}},
                }
            )

    # --- Fastest lap overall (DERIVED: min over measured laps) ---
    best = None
    for code, ll in laps.items():
        for row in ll:
            if row.get("pitLane") or row.get("flagged") or not row.get("time"):
                continue
            if best is None or row["time"] < best[1]:
                best = (code, row["time"], row["lap"])
    if best:
        code, tmin, lap = best
        # t of that lap start
        lt = next((r["t"] for r in laps[code] if r["lap"] == lap), 0)
        mm = _fmt_lap_time(tmin)
        moments.append(
            {
                "id": nid(),
                "t": lt,
                "lap": lap,
                "type": "fastest",
                "drivers": [code],
                "headline": f"Fastest lap: {code} {mm} (lap {lap})",
                "evidence": [_ev("Lap time", mm, "MEASURED"), _ev("Lap", str(lap), "MEASURED")],
                "explain": _template_fastest(code, mm, lap),
                "confidence": "high",
                "links": {"page": "compare", "params": {"d": code, "lap": lap}},
            }
        )

    # --- Gap battles (DERIVED from intervals: gapAhead < 1.0s sustained) ---
    iv_t: list = intervals.get("t", [])
    iv_dr: dict = intervals.get("drivers", {})
    if iv_t and iv_dr:
        for code, series in iv_dr.items():
            series_t = series.get("t") or iv_t
            gaps = series.get("gapAhead", [])
            ahead = series.get("ahead", [])
            if not gaps:
                continue
            j = 0
            while j < len(gaps):
                g = gaps[j]
                if g is not None and g < GAP_CLOSE_S and j > 0:
                    start = j
                    while j < len(gaps) and gaps[j] is not None and gaps[j] < GAP_SUSTAIN_S:
                        j += 1
                    if j - start >= GAP_MIN_SAMPLES and start > 0:
                        other = ahead[start] if start < len(ahead) else None
                        lap = _lap_at_t(ctx.get("lapStarts", []), series_t[start])
                        ev = [_ev("Gap ahead", f"{gaps[start]:.1f} s", "MEASURED")]
                        if other:
                            ev.append(_ev("Ahead", str(other), "MEASURED"))
                        ds = [code] + ([other] if other else [])
                        moments.append(
                            {
                                "id": nid(),
                                "t": series_t[start],
                                "lap": lap,
                                "type": "gap",
                                "drivers": ds,
                                "headline": f"{code} closes on {other or 'car ahead'}",
                                "evidence": ev,
                                "explain": _template_gap(code, other, gaps[start]),
                                "confidence": "medium",
                                "links": {
                                    "page": "compare",
                                    "params": {"d": ",".join(ds), "lap": lap},
                                },
                            }
                        )
                        continue
                j += 1

    moments.sort(key=lambda m: m["t"])
    # re-id in time order so m_042-style ids are chronological
    for i, m in enumerate(moments, 1):
        m["id"] = f"m_{i:03d}"
    return moments


def _lap_at_t(lap_starts: list, t: float) -> int:
    lap = 1
    for i, s in enumerate(lap_starts):
        if s <= t:
            lap = i + 1
        else:
            break
    return lap


def _fmt_lap_time(s: float) -> str:
    m = int(s // 60)
    return f"{m}:{s - m * 60:06.3f}"


def _pack(easy_en, easy_hi, pro_en, pro_hi):
    return {"easy": {"en": easy_en, "hi": easy_hi}, "pro": {"en": pro_en, "hi": pro_hi}}


def _template_overtake(a, b, pos, lap):
    return _pack(
        f"{a} passed {b} for position {pos} on lap {lap}. An overtake means one car takes the position of another on track.",
        f"Lap {lap} par {a} ne {b} ko overtake karke P{pos} le liya. Overtake ka matlab hai track par ek gaadi ne doosri se position cheen li.",
        f"{a} completed an overtake on {b} for P{pos} (lap {lap}).",
        f"Lap {lap} par {a} ne {b} par overtake complete kiya, P{pos}.",
    )


def _template_pit(d, lap, dur):
    ds = f" The stop lasted {dur:.1f} seconds." if dur else ""
    return _pack(
        f"{d} pitted on lap {lap} for fresh tyres. A pit stop means the car stopped in the pit lane to change tyres.{ds}",
        f"Lap {lap} par {d} ne pit stop liya, fresh tyres ke liye. Pit stop ka matlab hai gaadi tyres badalne ke liye ruki.{ds}",
        f"{d} pitted on lap {lap}.{ds} Watch the rejoin gap to judge the undercut.",
        f"Lap {lap} par {d} ka pit stop.{ds} Rejoin gap se undercut ka andaaza lagao.",
    )


def _template_flag(flag, lap):
    return _pack(
        f"Race control showed {flag} around lap {lap}. Flags mean drivers must slow down and overtaking may be banned in that zone.",
        f"Lap {lap} ke aas-paas {flag} flag nikla. Flag ka matlab hai drivers ko slow karna padta hai aur overtake mana ho sakta hai.",
        f"{flag} around lap {lap}. Gaps compress under SC/VSC; check intervals before and after.",
        f"Lap {lap} ke aas-paas {flag}. SC/VSC mein gaps compress hote hain.",
    )


def _template_fastest(code, mm, lap):
    return _pack(
        f"{code} set the fastest lap of the race so far, {mm} on lap {lap}. Fastest lap means the quickest single lap.",
        f"Lap {lap} par {code} ne sabse tez lap maara, {mm}. Fastest lap ka matlab hai sabse quick single lap.",
        f"Fastest lap: {code} {mm} (lap {lap}). Compare traces to see where the time came from.",
        f"Fastest lap: {code} {mm} (lap {lap}).",
    )


def _template_gap(code, other, g):
    tail = f" on {other}" if other else ""
    return _pack(
        f"{code} is closing in{tail} — the gap is about {g:.1f} seconds. Under a second usually means a fight is coming.",
        f"{code}{tail} ke kareeb aa raha hai — gap lagbhag {g:.1f} second hai. Ek second se kam gap ka matlab hai battle hone wali hai.",
        f"{code} within DRS range of {other or 'car ahead'} ({g:.1f} s).",
        f"{code} DRS range mein hai ({g:.1f} s).",
    )
