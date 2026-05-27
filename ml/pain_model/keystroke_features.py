"""
Keystroke Feature Engineering — converts raw timing events to ML features.
"""
import statistics
from typing import Optional


def extract_keystroke_features(events: list[dict]) -> Optional[dict]:
    """
    Input: list of {t: int (ms epoch), type: 'down'|'up'}
    Output: feature dict for pain model, or None if insufficient data.
    Privacy: no key content — timing metadata only.
    """
    if not events or len(events) < 10:
        return None

    downs = sorted([e["t"] for e in events if e.get("type") == "down"])
    ups   = sorted([e["t"] for e in events if e.get("type") == "up"])

    if len(downs) < 5:
        return None

    # Inter-key intervals
    ikis = [downs[i+1] - downs[i] for i in range(len(downs)-1) if 0 < downs[i+1] - downs[i] < 2000]

    # Dwell times (down to next up)
    dwells = []
    for d in downs:
        next_up = next((u for u in ups if u > d), None)
        if next_up:
            dwell = next_up - d
            if 0 < dwell < 500:
                dwells.append(dwell)

    if not ikis:
        return None

    iki_mean = statistics.mean(ikis)
    iki_std  = statistics.stdev(ikis) if len(ikis) > 1 else 0.0
    dwell_mean = statistics.mean(dwells) if dwells else 100.0

    duration_ms = (downs[-1] - downs[0]) if len(downs) > 1 else 1
    chars = len(downs)
    wpm = (chars / 5) / (duration_ms / 60000) if duration_ms > 0 else 0.0
    wpm = min(wpm, 200.0)

    # Pain index heuristic (0–10)
    pain_iki   = min(10.0, max(0.0, (iki_mean - 200) / 60.0))
    pain_var   = min(10.0, iki_std / 30.0)
    pain_speed = min(10.0, max(0.0, (100 - wpm) / 10.0))
    pain_index = round((pain_iki + pain_var + pain_speed) / 3.0, 2)

    return {
        "iki_mean":          round(iki_mean, 2),
        "iki_std":           round(iki_std, 2),
        "dwell_mean":        round(dwell_mean, 2),
        "typing_speed_wpm":  round(wpm, 1),
        "pain_index":        round(max(0.0, min(10.0, pain_index)), 2),
        "n_keystrokes":      len(downs),
    }
