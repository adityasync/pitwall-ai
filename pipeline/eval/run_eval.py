"""Run the AI eval set against a live dev server (/api/ask).

Usage (two steps — jobs don't persist across shells, run in ONE command):
    Start-Job ... pnpm dev --port 3123; Start-Sleep 15
    python pipeline/eval/run_eval.py http://localhost:3123
Results: pass/fail per question + summary. Record in docs/DECISIONS.md.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT / "pipeline"))
from explain_moments import FORBIDDEN, comparison_ok, numbers_ok, surnames_ok  # noqa: E402

REFUSAL = re.compile(r"cannot|missing|not available|don't have|does not contain|could not|unable", re.I)


def main() -> int:
    base = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3000"
    qs = json.loads((ROOT / "pipeline" / "eval" / "questions.json").read_text(encoding="utf-8"))["questions"]
    roster_cache: dict[str, set[str]] = {}

    def roster(race: str) -> set[str]:
        if race not in roster_cache:
            ds = json.loads((ROOT / "public" / "data" / race / "drivers.json").read_text(encoding="utf-8"))
            roster_cache[race] = {d["name"].split()[-1] for d in ds}
        return roster_cache[race]

    passed = failed = 0
    pack_cache: dict[str, dict] = {}

    def pack_for(race: str, question: str) -> tuple[dict, set[str]]:
        """Mirror /api/ask context construction (same roster + pool rules)."""
        key = race + "|" + question
        if key in pack_cache:
            p = pack_cache[key]
            return p["pack"], p["allowed"]
        base = ROOT / "public" / "data" / race
        meta = json.loads((base / "meta.json").read_text(encoding="utf-8"))
        ds = json.loads((base / "drivers.json").read_text(encoding="utf-8"))
        moments = json.loads((base / "moments.json").read_text(encoding="utf-8"))
        stats = json.loads((base / "stats.json").read_text(encoding="utf-8"))
        roster_d = {d["code"]: f"{d['name']} ({d['team']})" for d in ds}
        q = question.lower()
        mentioned = [c for c in roster_d
                     if c.lower() in q or roster_d[c].split(" (")[0].lower() in q]
        pool = mentioned or list(roster_d)[:6]
        rel = [m for m in moments
               if m["confidence"] != "low"
               and (not mentioned or any(c in mentioned for c in m.get("drivers", [])))]
        rel.sort(key=lambda m: -m["t"])
        rel = [{"headline": m["headline"], "evidence": m["evidence"], "drivers": m["drivers"]}
               for m in rel[:10]]
        pack = {"question": question, "race": meta["name"],
                "drivers": {c: roster_d[c] for c in pool},
                "pace": {c: stats.get("pace", {}).get(c) for c in pool},
                "fastestLap": stats.get("fastestLap", {}),
                "moments": rel, "coverage": meta["coverage"]}
        allowed = set()
        for c in mentioned + pool:
            allowed.add(roster_d[c].split(" (")[0].split(" ")[-1])
        fl = (stats.get("fastestLap") or {}).get("driver")
        if fl and fl in roster_d:
            allowed.add(roster_d[fl].split(" (")[0].split(" ")[-1])
        pack_cache[key] = {"pack": pack, "allowed": allowed}
        return pack, allowed

    for i, item in enumerate(qs, 1):
        try:
            r = requests.post(
                base + "/api/ask",
                json={"question": item["q"], "raceId": item["race"],
                      "lang": item.get("lang", "en"), "mode": item.get("mode", "easy")},
                timeout=120,
            )
            d = r.json()
        except Exception as e:  # noqa: BLE001
            print(f"[{i:02d}] ERROR {item['q'][:50]} — {e}")
            failed += 1
            continue
        text = d.get("text", "")
        ok, why = True, ""
        pack, allowed = pack_for(item["race"], item["q"])
        ctx = json.dumps(pack, ensure_ascii=False)
        if FORBIDDEN.search(text):
            ok, why = False, "forbidden-signal in answer"
        elif item.get("trap"):
            # trap: must refuse/decline AND stay clean (validators run on fallback too)
            if not (d.get("fallback") or REFUSAL.search(text)):
                # Q20-style: stats recital without a prediction counts as declined
                if re.search(r"will win|prediction|going to win", text, re.I):
                    ok, why = False, "trap answered with prediction"
        else:
            if not numbers_ok(text, ctx):
                ok, why = False, "number not in context pack"
            elif not surnames_ok(text, allowed, roster(item["race"])):
                ok, why = False, "unlisted surname"
            elif not comparison_ok(text):
                ok, why = False, "inverted comparison"
        # Hinglish check: hi answers must be Roman script (no Devanagari block)
        if ok and item.get("lang") == "hi" and re.search(r"[\u0900-\u097F]", text):
            ok, why = False, "Devanagari in Hinglish answer"
        print(f"[{'PASS' if ok else 'FAIL'}] [{i:02d}] {item['q'][:60]} {('— ' + why) if why else ''}")
        if ok:
            passed += 1
        else:
            failed += 1
            print(f"      text: {text[:220]}")
    print(f"\neval: {passed} passed, {failed} failed / {len(qs)}")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
