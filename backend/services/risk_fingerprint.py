"""
Surgical Risk Fingerprint — generated from OR telemetry JSON.
Produces an 8-parameter risk vector that personalizes all downstream monitoring.
"""
import hashlib
import json
import math
from typing import Optional

from pydantic import BaseModel

from backend.utils.logger import get_logger

log = get_logger(__name__)

# Population baseline values (cohort averages)
BASELINE = {
    "tissue_resistance_index": 1.0,
    "suture_tension_score": 2.0,
    "blood_loss_ml": 150.0,
    "procedure_duration_min": 120.0,
    "irrigation_events": 2,
    "retraction_events": 0,
}


class RiskFingerprint(BaseModel):
    tissue_resistance_index: float     # ratio vs cohort average (1.0 = average)
    suture_tension_score: float        # N/cm²
    blood_loss_class: str              # minimal | moderate | major
    anomaly_flags: list[str]           # e.g. ["minor_retraction_event"]
    healing_class: str                 # class_i_primary | class_ii_moderate | class_iii_complex
    procedure_risk_multiplier: float   # 1.0 = baseline; >1 = elevated
    data_quality: str                  # good | partial | synthetic
    fingerprint_hash: str              # SHA-256 of the fingerprint parameters


def _blood_loss_class(ml: float) -> str:
    if ml < 200:
        return "minimal"
    elif ml < 500:
        return "moderate"
    return "major"


def _healing_class(tri: float, suture: float, anomaly_count: int) -> str:
    score = tri + (suture / 2.0) + (anomaly_count * 0.3)
    if score < 1.8:
        return "class_i_primary"
    elif score < 2.5:
        return "class_ii_moderate"
    return "class_iii_complex"


def _risk_multiplier(tri: float, blood_class: str, anomaly_count: int) -> float:
    base = tri
    if blood_class == "moderate":
        base += 0.15
    elif blood_class == "major":
        base += 0.35
    base += anomaly_count * 0.1
    return round(base, 3)


def generate_fingerprint(telemetry: dict) -> RiskFingerprint:
    """
    Parse OR telemetry JSON and derive the patient's Risk Fingerprint.
    Falls back to synthetic values if telemetry fields are missing.
    """
    try:
        tri = float(telemetry.get("tissue_resistance_index", BASELINE["tissue_resistance_index"]))
        suture = float(telemetry.get("suture_tension_score", BASELINE["suture_tension_score"]))
        blood_ml = float(telemetry.get("blood_loss_ml", BASELINE["blood_loss_ml"]))
        anomaly_raw = telemetry.get("anomaly_flags", [])
        anomaly_flags = anomaly_raw if isinstance(anomaly_raw, list) else []
        data_quality = "good" if len(telemetry) > 4 else "partial"
    except Exception as exc:
        log.warning(f"Telemetry parse warning — using synthetic baseline: {exc}")
        tri = BASELINE["tissue_resistance_index"]
        suture = BASELINE["suture_tension_score"]
        blood_ml = BASELINE["blood_loss_ml"]
        anomaly_flags = []
        data_quality = "synthetic"

    blood_class = _blood_loss_class(blood_ml)
    healing = _healing_class(tri, suture, len(anomaly_flags))
    risk_mult = _risk_multiplier(tri, blood_class, len(anomaly_flags))

    params = {
        "tissue_resistance_index": round(tri, 3),
        "suture_tension_score": round(suture, 3),
        "blood_loss_class": blood_class,
        "anomaly_flags": sorted(anomaly_flags),
        "healing_class": healing,
        "procedure_risk_multiplier": risk_mult,
    }
    fingerprint_hash = hashlib.sha256(json.dumps(params, sort_keys=True).encode()).hexdigest()

    fp = RiskFingerprint(
        **params,
        data_quality=data_quality,
        fingerprint_hash=fingerprint_hash,
    )
    log.info(f"Risk Fingerprint generated — healing_class={healing} risk_mult={risk_mult} hash={fingerprint_hash[:8]}...")
    return fp
