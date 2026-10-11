"""PITWALL.AI data service — the backend that does the work.

Replaces "run the pipeline on a laptop, commit JSON". Same pipeline code,
now triggered over HTTP and served to the app:

  GET  /health                 liveness + index stats
  GET  /v1/index               race list (same shape as public/data/index.json)
  GET  /v1/freshness           per-race built_at mtimes ("updated Xh ago" signal)
  GET  /v1/race/{race_id}/{p}  any built file, e.g. moments, telemetry/VER
  POST /v1/ingest              {year, round} -> runs build_race + build_quali
                               (header x-ingest-secret must match INGEST_SECRET)

Design rules (kept deliberately boring):
- The repo's committed public/data is the source of truth; this service
  rebuilds into the same tree. Render disk is ephemeral, so a restart only
  loses uncommitted builds — the scheduled workflow recommits them.
- The Next app treats this service as progressive enhancement: it tries
  NEXT_PUBLIC_API_BASE first and falls back to static /data files, so the
  demo never depends on this box being awake (Render free sleeps).
- Phase 2 (post-submission) plugs the F1 official live-timing socket into
  the lifespan hook below and feeds the same shapes. Nothing here blocks that.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Header, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "public" / "data"
PIPELINE = ROOT / "pipeline"

_started_at = time.time()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Phase 2: start the live-timing socket ingester here. It writes into the
    # same DATA tree, so readers (below) need no changes.
    yield


app = FastAPI(title="pitwall-api", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o for o in os.getenv("SITE_URL", "*").split(",") if o],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


def _index() -> dict:
    p = DATA / "index.json"
    if not p.exists():
        raise HTTPException(404, "no index yet — POST /v1/ingest first")
    return json.loads(p.read_text(encoding="utf-8"))


@app.get("/health")
def health() -> dict:
    try:
        idx = _index()
        races = len(idx.get("races", []))
    except HTTPException:
        races = 0
    return {"ok": True, "races": races, "uptime_s": round(time.time() - _started_at)}


@app.get("/v1/index")
def index() -> JSONResponse:
    return JSONResponse(_index())


@app.get("/v1/freshness")
def freshness() -> dict:
    """When each race was last built — the UI turns this into 'updated Xh ago'."""
    out: dict[str, float | None] = {}
    for race_dir in sorted(p for p in DATA.iterdir() if p.is_dir() and p.name != "history"):
        meta = race_dir / "meta.json"
        out[race_dir.name] = meta.stat().st_mtime if meta.exists() else None
    idx = DATA / "index.json"
    return {"now": time.time(), "index_mtime": idx.stat().st_mtime if idx.exists() else None, "races": out}


@app.get("/v1/race/{race_id}/{subpath:path}")
def race_file(race_id: str, subpath: str) -> Response:
    if ".." in race_id or ".." in subpath or not subpath.endswith(".json"):
        raise HTTPException(400, "bad path")
    p = DATA / race_id / subpath
    if not p.is_file():
        raise HTTPException(404, {"error": "not built yet", "hint": f"POST /v1/ingest for {race_id}"})
    return Response(p.read_bytes(), media_type="application/json")


def _run(*args: str) -> tuple[int, str]:
    r = subprocess.run(
        [sys.executable, *args], cwd=str(ROOT), capture_output=True, text=True, timeout=3600
    )
    tail = (r.stdout + r.stderr)[-4000:]
    return r.returncode, tail


@app.post("/v1/ingest")
def ingest(body: dict, x_ingest_secret: str = Header(default="")) -> dict:
    secret = os.getenv("INGEST_SECRET", "")
    if not secret or x_ingest_secret != secret:
        raise HTTPException(401, "bad ingest secret")
    try:
        year, rnd = int(body["year"]), int(body["round"])
    except (KeyError, TypeError, ValueError):
        raise HTTPException(400, "body needs {year, round} ints")
    code, out = _run(str(PIPELINE / "build_race.py"), str(year), str(rnd))
    if code != 0:
        raise HTTPException(500, {"error": "build_race failed", "log": out})
    code_q, out_q = _run(str(PIPELINE / "build_quali.py"), str(year), str(rnd))
    return {"ok": code_q == 0, "year": year, "round": rnd, "log": (out + out_q)[-4000:]}
