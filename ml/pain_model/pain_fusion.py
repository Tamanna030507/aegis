"""
Pain Fusion Model — multi-signal pain score from voice + keystroke features.
"""
import numpy as np
from typing import Optional


def fuse_pain_scores(
    keystroke_pain_index: Optional[float],
    voice_pain_score: Optional[float],
    voice_confidence: Optional[float],
    pcps: Optional[float],
) -> dict:
    """
    Weighted fusion of pain signals.
    Weights: keystroke=0.35, voice=0.30 (confidence-scaled), pcps=0.35.
    Returns fused score and dominant signal.
    """
    signals, weights = {}, {}

    if keystroke_pain_index is not None and keystroke_pain_index >= 0:
        signals["keystroke"] = float(keystroke_pain_index)
        weights["keystroke"] = 0.35

    if voice_pain_score is not None and voice_pain_score >= 0:
        vc = float(voice_confidence or 0.5)
        signals["voice"] = float(voice_pain_score)
        weights["voice"] = 0.30 * vc

    if pcps is not None and pcps >= 0:
        signals["pcps"] = float(pcps)
        weights["pcps"] = 0.35

    if not signals:
        return {"fused": 5.0, "confidence": 0.0, "dominant": "none", "quality": "degraded"}

    total = sum(weights.values())
    normalized = {k: v / total for k, v in weights.items()}
    fused = round(max(0.0, min(10.0, sum(signals[k] * normalized[k] for k in signals))), 2)
    dominant = max(weights, key=weights.get)
    confidence = round(min(1.0, total), 2)
    quality = "good" if len(signals) == 3 else ("partial" if len(signals) >= 2 else "degraded")

    return {"fused": fused, "confidence": confidence, "dominant": dominant, "quality": quality}
