"""Pipeline unit tests: stats + moments (docs/03: pytest for the pipeline).

Run: python -m pytest pipeline -q
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from compute_stats import compute_stats
from detect_moments import detect_moments


def sample_ctx():
    laps = {
        "NOR": [
            {"lap": 1, "t": 0.0, "time": 95.0, "s1": 30.0, "s2": 35.0, "s3": 30.0,
             "compound": "MEDIUM", "tyreAge": 0, "inLap": False, "outLap": False,
             "flagged": False, "pitLane": False},
            {"lap": 2, "t": 95.0, "time": 96.0, "s1": 30.5, "s2": 35.2, "s3": 30.3,
             "compound": "MEDIUM", "tyreAge": 1, "inLap": False, "outLap": False,
             "flagged": False, "pitLane": False},
            {"lap": 3, "t": 191.0, "time": 120.0, "s1": 31.0, "s2": 36.0, "s3": 31.0,
             "compound": "MEDIUM", "tyreAge": 2, "inLap": True, "outLap": False,
             "flagged": False, "pitLane": True},
        ],
        "VER": [
            {"lap": 1, "t": 0.5, "time": 94.5, "s1": 29.8, "s2": 34.9, "s3": 29.8,
             "compound": "MEDIUM", "tyreAge": 0, "inLap": False, "outLap": False,
             "flagged": False, "pitLane": False},
        ],
    }
    stints = {
        "NOR": [{"stint": 1, "compound": "MEDIUM", "lapStart": 1, "lapEnd": 3, "ageAtStart": 0}],
        "VER": [{"stint": 1, "compound": "MEDIUM", "lapStart": 1, "lapEnd": 1, "ageAtStart": 0}],
    }
    return {
        "laps": laps, "stints": stints, "drivers": [],
        "pits": [{"driver": "NOR", "lap": 3, "t": 191.0, "duration": 23.3, "stationary": 2.4}],
        "overtakes": [{"t": 10.0, "lap": 1, "attacker": "NOR", "target": "VER", "position": 4}],
        "race_control": [], "intervals": {"t": [], "drivers": {}}, "lapStarts": [0.0],
    }


def test_pace_excludes_pit_laps():
    stats = compute_stats(sample_ctx())
    assert stats["pace"]["NOR"]["median"] == 95.5  # median of 95, 96 — not 120
    assert stats["pace"]["NOR"]["bestLap"] == 95.0
    assert stats["pace"]["NOR"]["trust"] == "DERIVED"


def test_fastest_lap_found():
    stats = compute_stats(sample_ctx())
    assert stats["fastestLap"]["driver"] == "VER"
    assert stats["fastestLap"]["time"] == 94.5


def test_moments_detect_overtake_and_pit():
    ctx = sample_ctx()
    moments = detect_moments(ctx)
    types = {m["type"] for m in moments}
    assert "overtake" in types
    assert "pit" in types
    assert "fastest" in types
    # ids chronological
    ts = [m["t"] for m in moments]
    assert ts == sorted(ts)
    assert moments[0]["id"] == "m_001"


def test_moment_evidence_has_trust():
    for m in detect_moments(sample_ctx()):
        assert m["evidence"], m["id"]
        for e in m["evidence"]:
            assert e["trust"] in ("MEASURED", "DERIVED", "ESTIMATE")
        assert set(m["explain"]) == {"easy", "pro"}
        assert set(m["explain"]["easy"]) == {"en", "hi"}
