"""Generate moment explanations offline (en + Hinglish, easy + pro) per docs/07.

Code builds the context pack from evidence only; the model only phrases it.
Server-side validation (required):
  1. Parse JSON; retry once on failure.
  2. Number check: every number in `text` must appear in the context pack.
     Retry once, then fall back to the template sentence from detect_moments.
  3. Strip claims about forbidden signals (brake pressure, steering, ERS,
     tyre temperature/tyre wear, fuel load, engine modes, setup).

Usage:
    python pipeline/explain_moments.py 2025-18-singapore [--max 30] [--all]
    ZAI_API_KEY / ZAI_BASE_URL / ZAI_MODEL env (see .env.example).
    Without a key: keeps template explanations, exits 0 with a warning.

NOTE: confirm the exact Z.ai base URL + model id against the current Z.ai
docs before relying on this (open question in docs/DECISIONS.md). The client
below speaks the OpenAI-compatible /chat/completions schema.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from pathlib import Path

import certifi
import requests

ROOT = Path(__file__).resolve().parent.parent

# Generation knobs — one place.
TEMPERATURE = 0.2  # low, for faithful phrasing
MAX_TOKENS = 300
REQUEST_TIMEOUT_S = 120
THROTTLE_S = 0.5  # polite gap between Z.ai calls
DEFAULT_MAX_MOMENTS = 30  # CLI --max default
HEADLINE_MAX = 120

SYSTEM = """You are the PITWALL.AI race explainer. You explain Formula 1 races using ONLY the facts in CONTEXT.
Rules:
1. Quote numbers exactly as given in CONTEXT. Never compute new numbers, never guess.
2. If CONTEXT does not contain what is needed, say what data is missing and stop. Do not speculate.
3. Only add the sentence "this is a model, not a measurement" when the fact you use is labelled ESTIMATE in CONTEXT. Never write it for MEASURED or DERIVED facts.
4. Brake data is on/off only; never claim brake pressure, steering, ERS or tyre temperature.
5. Refer to drivers ONLY by the codes and full names listed in CONTEXT. Never mention any other driver, past or present.
6. Mode EASY: one idea, plain words, explain any F1 term in one short clause. Max 3 sentences.
   Mode PRO: precise, may use terms (undercut, delta, apex), max 5 sentences.
7. Language EN or HI. HI means Hinglish: Roman-script Hindi with English F1 terms (pit stop, tyres, gap, DRS) kept in English. Natural, conversational, not formal Hindi.
9. When comparing lap times, a SMALLER number is FASTER. Never call a driver "the leader" unless the evidence says Position P1.
Return JSON: {"headline": string, "text": string, "used": [evidence labels you relied on]}"""

FORBIDDEN = re.compile(
    r"\bbrake pressure\b|\bbraking pressure\b|\bsteering\b|\bERS\b|\btyre temperature\b|\btire temperature\b|"
    r"\btyre wear\b|\btire wear\b|\bfuel load\b|\bengine mode\b|\bbrake bias\b|\bsetup\b",
    re.IGNORECASE,
)
NUMBER = re.compile(r"\d+(?:\.\d+)?")


def context_pack(moment: dict, stats: dict, coverage: dict, roster: dict) -> dict:
    """Minimal per-moment slice: evidence + roster + ONLY the stats rows for
    the moment's drivers. The full stats.json carries hundreds of numbers and
    makes the number check meaningless."""
    codes = moment.get("drivers", [])
    pace = {c: stats.get("pace", {}).get(c) for c in codes if c in stats.get("pace", {})}
    sectors = {c: stats.get("sectorBest", {}).get(c) for c in codes if c in stats.get("sectorBest", {})}
    return {
        "headline_hint": moment["headline"],
        "drivers": {c: roster.get(c, c) for c in codes},
        "evidence": moment["evidence"],
        "stats": {"pace": pace, "sectorBest": sectors, "fastestLap": stats.get("fastestLap", {})},
        "coverage": coverage,
    }


def context_text(pack: dict) -> str:
    return json.dumps(pack, ensure_ascii=False)


def numbers_ok(text: str, ctx: str) -> bool:
    ctx_nums = {float(n) for n in NUMBER.findall(ctx)}
    for n in NUMBER.findall(text):
        v = float(n)
        if v not in ctx_nums and not any(abs(v - c) < 1e-9 for c in ctx_nums):
            # allow the number as a formatted substring (e.g. "1:33.808" contains 33.808)
            if n not in ctx:
                return False
    return True


def strip_fences(s: str) -> str:
    s = s.strip()
    m = re.match(r"^```(?:json)?\s*(.*?)\s*```$", s, re.DOTALL)
    return m.group(1) if m else s


def call_model(base: str, key: str, model: str, system: str, user: str) -> dict | None:
    url = base.rstrip("/") + "/chat/completions"
    for attempt in range(2):
        try:
            r = requests.post(
                url,
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                json={
                    "model": model,
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": user},
                    ],
                    "temperature": TEMPERATURE,
                    "max_tokens": MAX_TOKENS,
                    "thinking": {"type": "disabled"},
                },
                timeout=REQUEST_TIMEOUT_S,
                verify=certifi.where(),
            )
            if r.status_code == 429:
                time.sleep(5)
                continue
            r.raise_for_status()
            content = r.json()["choices"][0]["message"]["content"]
            return json.loads(strip_fences(content))
        except Exception as e:  # noqa: BLE001
            print(f"    attempt {attempt + 1} failed: {e}")
            time.sleep(2)
    return None


MODEL_TIC = re.compile(
    r"\s*\.?\s*this is a model,? not a measurement\.?", re.IGNORECASE
)


def scrub_model_tic(text: str, evidence: list[dict]) -> str:
    """The model appends the ESTIMATE disclaimer as a tic even for MEASURED
    facts. Strip it unless the evidence actually contains an ESTIMATE."""
    if any(e.get("trust") == "ESTIMATE" for e in evidence):
        return text
    return MODEL_TIC.sub("", text).strip().rstrip(",.-– ").strip()


def comparison_ok(text: str) -> bool:
    """Lap-time comparisons: smaller is faster. Catches '95.555 is faster
    than 95.303' inversions the number check cannot see. Sentences split on
    punctuation+space so decimal points stay intact."""
    for sent in re.split(r"(?<=[.!?])\s+", text):
        m = re.search(r"(\d+\.\d+)[^.]*?\bfaster than\b[^.]*?(\d+\.\d+)", sent)
        if m and not float(m.group(1)) < float(m.group(2)):
            return False
        m = re.search(r"(\d+\.\d+)[^.]*?\bslower than\b[^.]*?(\d+\.\d+)", sent)
        if m and not float(m.group(1)) > float(m.group(2)):
            return False
    return True


def surnames_ok(text: str, allowed: set[str], roster: set[str]) -> bool:
    """No season-roster surname may appear unless it belongs to this moment."""
    for m in re.finditer(r"[A-Z][a-z]{2,}", text):
        w = m.group(0)
        if w in roster and w not in allowed:
            return False
    return True


def generate(pack: dict, mode: str, lang: str, base: str, key: str, model: str,
             allowed_names: set[str], roster_names: set[str], evidence_labels: list[str],
             has_estimate: bool) -> dict | None:
    user = f"MODE={mode} LANG={lang}\nCONTEXT={context_text(pack)}"
    for _ in range(2):  # initial + one retry
        ans = call_model(base, key, model, SYSTEM, user)
        if not ans or "text" not in ans:
            continue
        text = ans["text"]
        if FORBIDDEN.search(text):
            print("    forbidden signal claim — discarding")
            continue
        if not numbers_ok(text, context_text(pack)):
            print("    number check failed — retrying")
            continue
        if not surnames_ok(text, allowed_names, roster_names):
            print("    unlisted driver name — retrying")
            continue
        if not comparison_ok(text):
            print("    inverted lap-time comparison — retrying")
            continue
        used = [u for u in (ans.get("used") or []) if u in evidence_labels]
        if not has_estimate:
            text = MODEL_TIC.sub(
                lambda m: "." if m.group(0).lstrip().startswith(".") else "", text
            ).strip()
            text = re.sub(r"\.\.+", ".", text)
        return {"headline": ans.get("headline", ""), "text": text, "used": used}
    return None


def load_dotenv() -> None:
    """Load ROOT/.env.local into os.environ (no dependency, never committed)."""
    p = ROOT / ".env.local"
    if not p.exists():
        return
    for line in p.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip())


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("race_id")
    ap.add_argument('--max', type=int, default=DEFAULT_MAX_MOMENTS)
    ap.add_argument("--all", action="store_true")
    args = ap.parse_args()
    load_dotenv()

    key = os.environ.get("ZAI_API_KEY", "")
    base = os.environ.get("ZAI_BASE_URL", "https://api.z.ai/api/paas/v4")
    model = os.environ.get("ZAI_MODEL", "")
    race_dir = ROOT / "public" / "data" / args.race_id
    mpath = race_dir / "moments.json"
    if not mpath.exists():
        print(f"[explain] no {mpath}", file=sys.stderr)
        return 2
    moments = json.loads(mpath.read_text(encoding="utf-8"))
    stats = json.loads((race_dir / "stats.json").read_text(encoding="utf-8"))
    meta = json.loads((race_dir / "meta.json").read_text(encoding="utf-8"))
    drivers = json.loads((race_dir / "drivers.json").read_text(encoding="utf-8"))
    roster = {d["code"]: f"{d['name'].title()} ({d['team']})" for d in drivers}
    roster_names = {d["name"].split()[-1].capitalize() for d in drivers}

    if not key or not model:
        print("[explain] ZAI_API_KEY/ZAI_MODEL not set — keeping template explanations")
        return 0

    targets = [m for m in moments if m["confidence"] in ("high", "medium")]
    if args.all:
        # resumable: skip moments already generated (flagged below)
        targets = [m for m in targets if not m.get("generated")]
    else:
        targets = targets[: args.max]
    print(f"[explain] generating for {len(targets)} moments with {model}")
    changed = 0
    for mi, m in enumerate(targets, 1):
        pack = context_pack(m, stats, meta["coverage"], roster)
        allowed = {roster.get(c, c).split()[0] for c in m.get("drivers", [])}
        allowed |= {roster.get(c, c).split("(")[0].strip().split()[-1] for c in m.get("drivers", [])}
        fl = (stats.get("fastestLap") or {}).get("driver")
        if fl and fl in roster:
            allowed.add(roster[fl].split("(")[0].strip().split()[-1])
        labels = [e["label"] for e in m["evidence"]]
        has_est = any(e.get("trust") == "ESTIMATE" for e in m["evidence"])
        print(f"  [{mi}/{len(targets)}] {m['id']} {m['headline']}")
        new_exp = {"easy": dict(m["explain"]["easy"]), "pro": dict(m["explain"]["pro"])}
        for mode in ("easy", "pro"):
            for lang, code in (("en", "EN"), ("hi", "HI")):
                out = generate(pack, mode.upper(), code, base, key, model,
                               allowed, roster_names, labels, has_est)
                if out:
                    new_exp[mode]["en" if lang == "en" else "hi"] = out["text"]
                    if out["headline"] and mode == "easy" and lang == "en":
                        hl = out['headline'][:HEADLINE_MAX]
                        if numbers_ok(hl, context_text(pack)) and surnames_ok(
                            hl, allowed, roster_names
                        ):
                            m["headline"] = hl
                time.sleep(THROTTLE_S)  # polite throttle
        m["explain"] = new_exp
        m["generated"] = True
        changed += 1
        if changed % 5 == 0:
            mpath.write_text(json.dumps(moments, ensure_ascii=False), encoding="utf-8")
            print(f"  saved {changed}/{len(targets)}")
    mpath.write_text(json.dumps(moments, ensure_ascii=False), encoding="utf-8")
    print(f"[explain] done: {changed} moments updated")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
