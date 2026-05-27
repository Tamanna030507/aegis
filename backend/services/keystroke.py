"""
Keystroke Biomarker Processor.
Receives timing metadata windows and derives pain/impairment index.
PRIVACY: Only timing metadata processed — no key content ever stored.
"""
import statistics
from typing import Optional

from pydantic import BaseModel

from backend.utils.logger import get_logger

log = get_logger(__name__)


class KeystrokeWindow(BaseModel):
    """Timing metadata for a 30-minute typing window. No key values."""
    patient_id: str
    window_start_ms: int
    events: list[dict]  # [{t: int, type: "down"|"up"}]
    total_keystrokes: int


class KeystrokeFeatures(BaseModel):
    iki_mean: float           # inter-key interval mean (ms)
    iki_std: float            # inter-key interval std dev
    dwell_mean: float         # key dwell time mean (ms)
    error_rate: float         # proportion of events that are backspaces (proxy)
    backspace_ratio: float    # fraction backspaces / total events
    typing_speed_wpm: float   # estimated words per minute
    pain_index: float         # 0–10 derived score


def _safe_std(values: list[float]) -> float:
    if len(values) < 2:
        return 0.0
    return statistics.stdev(values)


def extract_features(window: KeystrokeWindow) -> Optional[KeystrokeFeatures]:
    """Derive typing biomarker features from a raw event window."""
    try:
        events = window.events
        if len(events) < 10:
            log.debug(f"Keystroke window too short ({len(events)} events) — skipping")
            return None

        downs = [e for e in events if e.get("type") == "down"]
        ups   = [e for e in events if e.get("type") == "up"]

        # Inter-key intervals (time between consecutive key-downs)
        down_times = sorted([e["t"] for e in downs])
        ikis = [down_times[i+1] - down_times[i] for i in range(len(down_times)-1)]
        ikis = [iki for iki in ikis if 0 < iki < 2000]  # filter pauses

        # Dwell times (time between down and corresponding up)
        up_map = {e["t"]: e for e in ups}
        dwells = []
        for d in downs:
            matching_up = [e["t"] for e in ups if e["t"] > d["t"]]
            if matching_up:
                dwells.append(min(matching_up) - d["t"])

        dwells = [d for d in dwells if 0 < d < 500]

        iki_mean   = statistics.mean(ikis) if ikis else 200.0
        iki_std    = _safe_std(ikis)
        dwell_mean = statistics.mean(dwells) if dwells else 100.0

        # Typing speed (chars / 5 = words, duration in minutes)
        duration_ms = (down_times[-1] - down_times[0]) if len(down_times) > 1 else 1
        chars = len(downs)
        speed_wpm = (chars / 5) / (duration_ms / 60000) if duration_ms > 0 else 0.0
        speed_wpm = min(speed_wpm, 200.0)  # cap at realistic max

        # Pain index: slow IKI, high variance, low speed → high pain
        # Normalized: IKI_mean~200ms=0, 800ms=10; IKI_std~50=0, 300=10; speed~100wpm=0, 0wpm=10
        pain_iki   = min(10.0, (iki_mean - 200) / 60.0)
        pain_var   = min(10.0, iki_std / 30.0)
        pain_speed = min(10.0, max(0.0, (100 - speed_wpm) / 10.0))
        pain_index = round(max(0.0, min(10.0, (pain_iki + pain_var + pain_speed) / 3.0)), 2)

        return KeystrokeFeatures(
            iki_mean=round(iki_mean, 2),
            iki_std=round(iki_std, 2),
            dwell_mean=round(dwell_mean, 2),
            error_rate=0.0,  # extended via backspace tracking if available
            backspace_ratio=0.0,
            typing_speed_wpm=round(speed_wpm, 1),
            pain_index=pain_index,
        )

    except Exception as exc:
        log.error(f"Keystroke feature extraction failed: {exc}")
        return None
