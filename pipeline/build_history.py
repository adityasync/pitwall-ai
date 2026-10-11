"""Build history JSON from Ergast CSVs in data/ (Kaggle mirror, 1950-2026).

Reads: races, results, drivers, constructors, driver_standings,
       constructor_standings, qualifying, circuits, status,
       pit_stops, sprint_results, lap_times, constructor_results.
Writes small curated files the UI reads (never ship 29MB raw to client):
  public/data/history/seasons.json    per-year champs + race winners + pole/fastest/DNF/pits
  public/data/history/drivers.json    career totals for every driver (+points/DNF/sprint wins)
  public/data/history/circuits.json   per-circuit races + top winners + lap record
  public/data/history/teams.json      every team: titles/wins/points/pits/DNFs
  public/data/history/title.json      per-year top-5 points progression (title-fight chart)
  public/data/history/h2h.json        per-year teammate quali/race score
  public/data/history/reliability.json DNF causes + pit-stop leaders

Usage: python pipeline/build_history.py
"""

from __future__ import annotations

import csv
import json
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
OUT = ROOT / "public" / "data" / "history"


def read(name: str) -> list[dict]:
    with open(DATA / name, newline="", encoding="utf-8") as fh:
        return list(csv.DictReader(fh))


def null(v: str | None) -> str | None:
    return None if v in (None, "", "\\N") else v


def main() -> int:
    races = read("races.csv")
    results = read("results.csv")
    drivers = read("drivers.csv")
    constructors = read("constructors.csv")
    dstand = read("driver_standings.csv")
    cstand = read("constructor_standings.csv")
    quali = read("qualifying.csv")
    circuits = read("circuits.csv")
    status_rows = read("status.csv")
    pits = read("pit_stops.csv")
    sprints = read("sprint_results.csv")
    cres = read("constructor_results.csv")

    dname = {d["driverId"]: f"{d['forename']} {d['surname']}" for d in drivers}
    dcode = {d["driverId"]: null(d["code"]) or d["driverRef"].upper()[:3] for d in drivers}
    tname = {c["constructorId"]: c["name"] for c in constructors}
    race_by_id = {r["raceId"]: r for r in races}
    status_by_id = {s["statusId"]: s["status"] for s in status_rows}

    def is_dnf(status_text: str | None) -> bool:
        if not status_text:
            return True
        return not (status_text == "Finished" or status_text.startswith("+"))

    # pole sitter per race (qualifying position == 1)
    pole_by_race: dict[str, dict] = {}
    for q in quali:
        if q["position"] == "1" and q["raceId"] not in pole_by_race:
            pole_by_race[q["raceId"]] = {"driverId": q["driverId"]}
    # fastest lap per race (results rank == 1)
    fastest_by_race: dict[str, dict] = {}
    for r in results:
        if r.get("rank") == "1" and r["raceId"] not in fastest_by_race:
            fastest_by_race[r["raceId"]] = {"driverId": r["driverId"], "time": null(r.get("fastestLapTime"))}
    # DNF count per race + per driver
    dnf_by_race: dict[str, int] = defaultdict(int)
    dnf_by_driver: dict[str, int] = defaultdict(int)
    points_by_driver: dict[str, float] = defaultdict(float)
    for r in results:
        st = status_by_id.get(r["statusId"], "")
        if is_dnf(st):
            dnf_by_race[r["raceId"]] += 1
            dnf_by_driver[r["driverId"]] += 1
        try:
            pts = float(r["points"]) if null(r["points"]) else 0.0
        except ValueError:
            pts = 0.0
        points_by_driver[r["driverId"]] += pts
    # pit stop count per race
    pits_by_race: dict[str, int] = defaultdict(int)
    for p in pits:
        pits_by_race[p["raceId"]] += 1
    # sprint winners (2021+ weekends only)
    sprint_by_race: dict[str, dict] = {}
    sprint_wins: dict[str, int] = defaultdict(int)
    for s in sprints:
        try:
            po = int(s["positionOrder"])
        except ValueError:
            continue
        if po == 1:
            sprint_wins[s["driverId"]] += 1
            if s["raceId"] not in sprint_by_race:
                sprint_by_race[s["raceId"]] = {"driverId": s["driverId"]}
    # lap record per circuit — stream lap_times (24MB) without holding all rows
    record_by_circ: dict[str, dict] = {}
    with open(DATA / "lap_times.csv", newline="", encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            try:
                ms = int(row["milliseconds"])
            except (ValueError, TypeError):
                continue
            race = race_by_id.get(row["raceId"])
            if not race:
                continue
            cid = race["circuitId"]
            cur = record_by_circ.get(cid)
            if cur is None or ms < cur["ms"]:
                record_by_circ[cid] = {
                    "ms": ms, "time": row["time"],
                    "driverId": row["driverId"], "year": int(race["year"]),
                }

    # results by race
    res_by_race: dict[str, list[dict]] = defaultdict(list)
    for r in results:
        res_by_race[r["raceId"]].append(r)
    for v in res_by_race.values():
        v.sort(key=lambda r: int(r["positionOrder"]))

    # champs: last standings row per year (max raceId per year)
    champ_d: dict[str, dict] = {}
    by_race_d: dict[str, list[dict]] = defaultdict(list)
    for s in dstand:
        by_race_d[s["raceId"]].append(s)
    for r in races:
        rows = [s for s in by_race_d.get(r["raceId"], []) if s["position"] == "1"]
        if rows:
            champ_d[r["year"]] = {"driver": dname.get(rows[0]["driverId"], "?"), "points": rows[0]["points"], "wins": rows[0]["wins"]}
    champ_c: dict[str, dict] = {}
    by_race_c: dict[str, list[dict]] = defaultdict(list)
    for s in cstand:
        by_race_c[s["raceId"]].append(s)
    for r in races:
        rows = [s for s in by_race_c.get(r["raceId"], []) if s["position"] == "1"]
        if rows:
            champ_c[r["year"]] = {"team": tname.get(rows[0]["constructorId"], "?"), "points": rows[0]["points"], "wins": rows[0]["wins"]}

    seasons = []
    for r in sorted(races, key=lambda x: (int(x["year"]), int(x["round"]))):
        rows = res_by_race.get(r["raceId"], [])
        winner = next((x for x in rows if x["positionOrder"] == "1"), None)
        pole = pole_by_race.get(r["raceId"])
        fast = fastest_by_race.get(r["raceId"])
        spr = sprint_by_race.get(r["raceId"])
        seasons.append({
            "year": int(r["year"]), "round": int(r["round"]),
            "name": r["name"], "date": r["date"], "circuitId": r["circuitId"],
            "winner": dname.get(winner["driverId"]) if winner else None,
            "winnerCode": dcode.get(winner["driverId"]) if winner else None,
            "team": tname.get(winner["constructorId"]) if winner else None,
            "pole": dname.get(pole["driverId"]) if pole else None,
            "poleCode": dcode.get(pole["driverId"]) if pole else None,
            "fastest": dname.get(fast["driverId"]) if fast else None,
            "fastestCode": dcode.get(fast["driverId"]) if fast else None,
            "fastestTime": fast["time"] if fast else None,
            "dnfs": dnf_by_race.get(r["raceId"], 0),
            "pits": pits_by_race.get(r["raceId"], 0),
            "sprintWinner": dname.get(spr["driverId"]) if spr else None,
            "sprintWinnerCode": dcode.get(spr["driverId"]) if spr else None,
        })
    by_year: dict[int, dict] = {}
    for s in seasons:
        y = by_year.setdefault(s["year"], {"year": s["year"], "races": [], "champDriver": None, "champTeam": None})
        y["races"].append(s)
    for y, d in champ_d.items():
        by_year[int(y)]["champDriver"] = d
    for y, c in champ_c.items():
        by_year[int(y)]["champTeam"] = c
    years = [by_year[y] for y in sorted(by_year)]

    # driver careers
    starts: dict[str, int] = defaultdict(int)
    wins: dict[str, int] = defaultdict(int)
    podiums: dict[str, int] = defaultdict(int)
    poles: dict[str, int] = defaultdict(int)
    fastest: dict[str, int] = defaultdict(int)
    for r in results:
        did = r["driverId"]
        starts[did] += 1
        try:
            po = int(r["positionOrder"])
        except ValueError:
            continue
        if po == 1:
            wins[did] += 1
        if po <= 3:
            podiums[did] += 1
        if r.get("rank") == "1":
            fastest[did] += 1
    for q in quali:
        if q["position"] == "1":
            poles[q["driverId"]] += 1
    # titles from standings
    titles: dict[str, int] = defaultdict(int)
    for y, d in champ_d.items():
        for did, nm in dname.items():
            if nm == d["driver"]:
                titles[did] += 1
                break
    careers = []
    for d in drivers:
        did = d["driverId"]
        if starts[did] == 0:
            continue
        careers.append({
            "id": did, "code": dcode[did], "name": dname[did],
            "nationality": d["nationality"], "starts": starts[did],
            "wins": wins[did], "podiums": podiums[did],
            "poles": poles[did], "fastest": fastest[did], "titles": titles[did],
            "points": round(points_by_driver.get(did, 0.0), 1),
            "dnfs": dnf_by_driver.get(did, 0),
            "sprintWins": sprint_wins.get(did, 0),
        })
    careers.sort(key=lambda c: (-c["titles"], -c["wins"], -c["podiums"]))

    # circuits
    circ_by_id = {c["circuitId"]: c for c in circuits}
    circ_races: dict[str, list[dict]] = defaultdict(list)
    for r in races:
        circ_races[r["circuitId"]].append(r)
    circuit_list = []
    for cid, c in circ_by_id.items():
        rs = sorted(circ_races.get(cid, []), key=lambda x: (int(x["year"]), int(x["round"])))
        if not rs:
            continue
        wc: dict[str, int] = defaultdict(int)
        last = None
        for r in rs:
            rows = res_by_race.get(r["raceId"], [])
            w = next((x for x in rows if x["positionOrder"] == "1"), None)
            if w:
                wc[dname.get(w["driverId"], "?")] += 1
                last = {"year": int(r["year"]), "driver": dname.get(w["driverId"]), "team": tname.get(w["constructorId"])}
        top = sorted(wc.items(), key=lambda kv: -kv[1])[:5]
        rec = record_by_circ.get(cid)
        circuit_list.append({
            "id": cid, "ref": c["circuitRef"], "name": c["name"],
            "location": c["location"], "country": c["country"],
            "lat": float(c["lat"]) if null(c["lat"]) else None,
            "lng": float(c["lng"]) if null(c["lng"]) else None,
            "races": len(rs), "first": int(rs[0]["year"]), "last": int(rs[-1]["year"]),
            "topWinners": [{"driver": k, "wins": v} for k, v in top],
            "lastWinner": last,
            "lapRecord": ({
                "time": rec["time"], "driver": dname.get(rec["driverId"]),
                "code": dcode.get(rec["driverId"]), "year": rec["year"],
            } if rec else None),
        })
    circuit_list.sort(key=lambda c: -c["races"])

    # ---- teams: titles / wins / points / DNFs / pit stats (constructor_results + standings) ----
    # titles per constructor (champion after final round of each year)
    title_by_team: dict[str, int] = defaultdict(int)
    champ_cid: dict[str, str] = {}
    for r in races:
        rows = [s for s in by_race_c.get(r["raceId"], []) if s["position"] == "1"]
        if rows:
            champ_cid[r["year"]] = rows[0]["constructorId"]
    for cid in champ_cid.values():
        title_by_team[cid] += 1
    wins_by_team: dict[str, int] = defaultdict(int)
    pts_by_team: dict[str, float] = defaultdict(float)
    races_by_team: dict[str, set] = defaultdict(set)
    dnf_by_team: dict[str, int] = defaultdict(int)
    res_team: dict[tuple, str] = {}
    for r in results:
        key = (r["raceId"], r["driverId"])
        res_team[key] = r["constructorId"]
        cid = r["constructorId"]
        races_by_team[cid].add(r["raceId"])
        try:
            pts_by_team[cid] += float(r["points"]) if null(r["points"]) else 0.0
        except ValueError:
            pass
        try:
            if int(r["positionOrder"]) == 1:
                wins_by_team[cid] += 1
        except ValueError:
            pass
        if is_dnf(status_by_id.get(r["statusId"], "")):
            dnf_by_team[cid] += 1
    # pit durations per team (join pit -> constructor via results; drop red-flag outliers)
    pit_sum: dict[str, float] = defaultdict(float)
    pit_n: dict[str, int] = defaultdict(int)
    pit_best: dict[str, int] = {}
    for p in pits:
        cid = res_team.get((p["raceId"], p["driverId"]))
        if not cid:
            continue
        try:
            ms = int(p["milliseconds"])
        except (ValueError, TypeError):
            continue
        if ms < 1800 or ms > 60000:
            continue
        pit_sum[cid] += ms
        pit_n[cid] += 1
        if cid not in pit_best or ms < pit_best[cid]:
            pit_best[cid] = ms
    teams = []
    for c in constructors:
        cid = c["constructorId"]
        if not races_by_team.get(cid) and title_by_team.get(cid, 0) == 0:
            continue
        n = pit_n.get(cid, 0)
        teams.append({
            "id": cid, "name": c["name"], "nationality": c["nationality"],
            "titles": title_by_team.get(cid, 0),
            "wins": wins_by_team.get(cid, 0),
            "points": round(pts_by_team.get(cid, 0.0), 1),
            "races": len(races_by_team.get(cid, set())),
            "dnfs": dnf_by_team.get(cid, 0),
            "avgPit": round(pit_sum[cid] / n / 1000, 2) if n else None,
            "bestPit": round(pit_best[cid] / 1000, 2) if cid in pit_best else None,
            "pitStops": n,
        })
    teams.sort(key=lambda t: (-t["titles"], -t["wins"], -t["points"]))

    # ---- title progression: top-5 drivers' points after every round (driver_standings) ----
    stand_by_race: dict[str, dict[str, float]] = {}
    for s in dstand:
        try:
            pts = float(s["points"])
        except ValueError:
            pts = 0.0
        stand_by_race.setdefault(s["raceId"], {})[s["driverId"]] = pts
    races_by_year: dict[int, list[dict]] = defaultdict(list)
    for r in races:
        races_by_year[int(r["year"])].append(r)
    for y in races_by_year.values():
        y.sort(key=lambda r: int(r["round"]))
    title_prog = []
    for year in sorted(races_by_year):
        yraces = races_by_year[year]
        last_id = yraces[-1]["raceId"]
        final = sorted(
            ({"did": did, "pts": pts} for did, pts in stand_by_race.get(last_id, {}).items()),
            key=lambda x: -x["pts"],
        )[:5]
        if not final:
            continue
        dids = [f["did"] for f in final]
        series = []
        for r in yraces:
            lookup = stand_by_race.get(r["raceId"], {})
            series.append([lookup.get(d, 0.0) for d in dids])
        title_prog.append({
            "year": year,
            "codes": [dcode.get(d, "?") for d in dids],
            "names": [dname.get(d, "?") for d in dids],
            "rounds": [int(r["round"]) for r in yraces],
            "points": series,
        })

    # ---- teammate head-to-head per year+team (qualifying + results) ----
    quali_pos: dict[tuple, int] = {}
    for q in quali:
        try:
            pos = int(q["position"])
        except ValueError:
            continue
        quali_pos[(q["raceId"], q["driverId"])] = pos
    race_pos: dict[tuple, int] = {}
    for r in results:
        try:
            po = int(r["positionOrder"])
        except ValueError:
            continue
        race_pos[(r["raceId"], r["driverId"])] = po
    h2h = []
    for year in sorted(races_by_year):
        yrace_ids = {r["raceId"] for r in races_by_year[year]}
        team_drivers: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
        for (rid, did), cid in res_team.items():
            if rid in yrace_ids:
                team_drivers[cid][did] += 1
        for cid, counts in team_drivers.items():
            top2 = sorted(counts.items(), key=lambda kv: -kv[1])[:2]
            if len(top2) < 2:
                continue
            a, b = top2[0][0], top2[1][0]
            qa = qb = ra = rb = 0
            for r in races_by_year[year]:
                rid = r["raceId"]
                pa, pb = quali_pos.get((rid, a)), quali_pos.get((rid, b))
                if pa is not None and pb is not None and pa != pb:
                    if pa < pb:
                        qa += 1
                    else:
                        qb += 1
                fa, fb = race_pos.get((rid, a)), race_pos.get((rid, b))
                if fa is not None and fb is not None and fa != fb:
                    if fa < fb:
                        ra += 1
                    else:
                        rb += 1
            if qa + qb + ra + rb == 0:
                continue
            h2h.append({
                "year": year, "team": tname.get(cid, "?"),
                "aCode": dcode.get(a, "?"), "bCode": dcode.get(b, "?"),
                "qualiA": qa, "qualiB": qb, "raceA": ra, "raceB": rb,
            })
    h2h.sort(key=lambda x: (-x["year"], x["team"]))

    # ---- reliability: DNF causes + pit leaders ----
    cause_n: dict[str, int] = defaultdict(int)
    for r in results:
        st = status_by_id.get(r["statusId"], "")
        if is_dnf(st):
            cause_n[st] += 1
    causes = [{"cause": k, "count": v} for k, v in sorted(cause_n.items(), key=lambda kv: -kv[1])[:15]]
    pit_leaders = [
        {"team": tname.get(t["id"], "?"), "avg": t["avgPit"], "best": t["bestPit"], "count": t["pitStops"]}
        for t in teams if t["avgPit"] is not None and t["pitStops"] >= 20
    ]
    pit_leaders.sort(key=lambda x: x["avg"])
    reliability = {
        "causes": causes,
        "pitLeaders": pit_leaders[:10],
        "totalPits": sum(pit_n.values()),
        "totalDnfs": sum(cause_n.values()),
    }

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "seasons.json").write_text(json.dumps(years), encoding="utf-8")
    (OUT / "drivers.json").write_text(json.dumps(careers), encoding="utf-8")
    (OUT / "circuits.json").write_text(json.dumps(circuit_list), encoding="utf-8")
    (OUT / "teams.json").write_text(json.dumps(teams), encoding="utf-8")
    (OUT / "title.json").write_text(json.dumps(title_prog), encoding="utf-8")
    (OUT / "h2h.json").write_text(json.dumps(h2h), encoding="utf-8")
    (OUT / "reliability.json").write_text(json.dumps(reliability), encoding="utf-8")
    import gzip
    total = sum(len(gzip.compress(p.read_bytes(), 9)) for p in OUT.glob("*.json"))
    print(f"[history] years={len(years)} drivers={len(careers)} circuits={len(circuit_list)} teams={len(teams)} gz={total/1e3:.0f}KB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
