"""Pain Fusion Agent — fuses keystroke + voice + PCPS pain signals."""
from typing import Optional
from pydantic import BaseModel
from backend.utils.logger import get_logger

log = get_logger(__name__)


class PainFusionResult(BaseModel):
    fused_pain_score: float
    keystroke_component: float
    voice_component: float
    pcps: float
    confidence: float
    dominant_signal: str
    data_quality: str


def fuse_pain_signals(
    keystroke_pain_index: Optional[float],
    voice_pain_score: Optional[float],
    voice_confidence: Optional[float],
    raw_pain_score: Optional[float],
    pcps: Optional[float],
) -> PainFusionResult:
    """Weighted fusion: keystroke=0.35, voice=0.30, pcps=0.35. Redistributes if signal missing."""
    try:
        signals = {}
        weights = {}

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
        elif raw_pain_score is not None:
            signals["pcps"] = float(raw_pain_score)
            weights["pcps"] = 0.25

        if not signals:
            return PainFusionResult(fused_pain_score=5.0, keystroke_component=0.0,
                                    voice_component=0.0, pcps=5.0, confidence=0.0,
                                    dominant_signal="none", data_quality="degraded")

        total_weight = sum(weights.values())
        normalized = {k: v / total_weight for k, v in weights.items()}
        fused = round(max(0.0, min(10.0, sum(signals[k] * normalized[k] for k in signals))), 2)
        dominant = max(weights, key=weights.get)
        confidence = round(min(1.0, total_weight), 2)
        data_quality = "good" if len(signals) == 3 else ("partial" if len(signals) >= 2 else "degraded")

        return PainFusionResult(
            fused_pain_score=fused,
            keystroke_component=round(signals.get("keystroke", 0.0), 2),
            voice_component=round(signals.get("voice", 0.0), 2),
            pcps=round(signals.get("pcps", 0.0), 2),
            confidence=confidence,
            dominant_signal=dominant,
            data_quality=data_quality,
        )
    except Exception as exc:
        log.error(f"Pain fusion failed: {exc}")
        return PainFusionResult(fused_pain_score=5.0, keystroke_component=0.0,
                                voice_component=0.0, pcps=5.0, confidence=0.0,
                                dominant_signal="none", data_quality="degraded")
