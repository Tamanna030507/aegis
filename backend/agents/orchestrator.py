"""
Master Orchestrator Agent — routes incoming check-in signals to sub-agents.
Produces: updated risk score, cascade DAG, Evidence Brief (if escalation needed).
Improvements:
  - wound_score_delta computed from DB history
  - temp_trend computed from DB history
  - Dynamic weight redistribution when wound vision unavailable
  - pain_agent.fuse_pain_signals is now sync (no await)
"""
import asyncio
import json
from typing import Optional

from backend.agents import wound_agent, pain_agent, cascade_agent, escalation_agent
from backend.services import pk_correction, keystroke as keystroke_svc
from backend.config import ESCALATION_RISK_THRESHOLD
from backend.utils.logger import get_logger

log = get_logger(__name__)


def _get_wound_delta(patient_id: str, current_score: float) -> float:
    """Return wound score change since last check-in. Negative = deteriorating."""
    try:
        from backend.database import SessionLocal
        from backend.models.checkin import CheckIn as CheckInModel
        db = SessionLocal()
        try:
            prev = (
                db.query(CheckInModel)
                .filter(
                    CheckInModel.patient_id == patient_id,
                    CheckInModel.wound_score.isnot(None),
                )
                .order_by(CheckInModel.created_at.desc())
                .offset(1)   # skip most recent (current)
                .first()
            )
            if prev and prev.wound_score is not None:
                return round(float(current_score) - float(prev.wound_score), 2)
        finally:
            db.close()
    except Exception as e:
        log.debug(f"wound_delta lookup failed: {e}")
    return 0.0


def _get_temp_trend(patient_id: str, current_temp: float) -> float:
    """Return temperature change since last check-in. Positive = rising (concerning)."""
    try:
        from backend.database import SessionLocal
        from backend.models.checkin import CheckIn as CheckInModel
        db = SessionLocal()
        try:
            prev = (
                db.query(CheckInModel)
                .filter(
                    CheckInModel.patient_id == patient_id,
                    CheckInModel.temperature.isnot(None),
                )
                .order_by(CheckInModel.created_at.desc())
                .offset(1)
                .first()
            )
            if prev and prev.temperature:
                return round(float(current_temp) - float(prev.temperature), 2)
        finally:
            db.close()
    except Exception as e:
        log.debug(f"temp_trend lookup failed: {e}")
    return 0.0


async def process_checkin(
    patient_id: str,
    checkin_data: dict,
    patient_meta: dict,
    image_bytes: Optional[bytes] = None,
    audio_bytes: Optional[bytes] = None,
) -> dict:
    """
    Full check-in orchestration pipeline.
    Runs wound + voice + keystroke in parallel, then cascade + escalation.
    Returns enriched result dict for persistence.
    """
    log.info(f"Orchestrator: processing check-in for patient={patient_id}")

    day_post_op   = checkin_data.get("day_post_op", 1)
    raw_pain      = checkin_data.get("raw_pain_score")
    drug          = checkin_data.get("medication_drug")
    hours_since   = checkin_data.get("medication_hours_since_dose")
    temperature   = checkin_data.get("temperature")
    keystroke_win = checkin_data.get("keystroke_window")

    # ── Step 1: PK correction (sync, fast) ───────────────────────────────────
    pcps, pk_corrected = (None, False)
    if raw_pain is not None and drug and hours_since is not None:
        pcps, pk_corrected = pk_correction.compute_pcps(raw_pain, drug, hours_since)

    # ── Step 2: Keystroke features (sync) ─────────────────────────────────────
    keystroke_features = None
    if keystroke_win:
        from backend.services.keystroke import KeystrokeWindow
        try:
            kw = KeystrokeWindow(**keystroke_win)
            keystroke_features = keystroke_svc.extract_features(kw)
        except Exception as e:
            log.warning(f"Keystroke processing failed: {e}")

    # ── Step 3: Wound + Voice in parallel (async IO) ──────────────────────────
    wound_task = wound_agent.analyze_wound(image_bytes) if image_bytes else None
    voice_task = None
    if audio_bytes:
        from backend.services.voice import extract_voice_features
        voice_task = asyncio.to_thread(extract_voice_features, audio_bytes, "voice.webm")

    tasks = [t for t in [wound_task, voice_task] if t is not None]
    results = await asyncio.gather(*tasks, return_exceptions=True) if tasks else []

    wound_result, voice_result = None, None
    idx = 0
    if wound_task:
        r = results[idx] if idx < len(results) else None
        wound_result = r if not isinstance(r, Exception) else None
        idx += 1
    if voice_task and idx < len(results):
        r = results[idx]
        voice_result = r if not isinstance(r, Exception) else None

    # ── Step 4: Pain fusion (sync — pure arithmetic) ──────────────────────────
    ks_pain    = keystroke_features.pain_index if keystroke_features else None
    voice_pain = voice_result.pain_score if voice_result else None
    voice_conf = voice_result.confidence if voice_result else None

    pain_result = pain_agent.fuse_pain_signals(ks_pain, voice_pain, voice_conf, raw_pain, pcps)

    # ── Step 5: Compute wound delta + temp trend for ML ───────────────────────
    wound_available = (
        wound_result is not None
        and wound_result.data_quality != "unavailable"
        and wound_result.wound_score is not None
    )
    wound_score = wound_result.wound_score if wound_available else None
    wound_delta = _get_wound_delta(patient_id, wound_score or 70.0)
    temp_trend  = _get_temp_trend(patient_id, float(temperature or 37.0))

    # ── Step 6: Dynamic risk weights (redistribute if wound vision unavailable)
    if wound_available:
        w_wound, w_pain, w_temp, w_tri = 0.40, 0.35, 0.10, 0.15
    else:
        w_wound, w_pain, w_temp, w_tri = 0.00, 0.55, 0.15, 0.30
        log.info("Wound vision unavailable — redistributing risk weights to pain + TRI")

    wound_risk = max(0.0, (100 - (wound_score or 70)) / 100) if wound_available else 0.0
    pain_risk  = pain_result.fused_pain_score / 10.0
    temp_risk  = min(1.0, max(0.0, (float(temperature or 37.0) - 37.0) / 2.0))
    tri_bonus  = max(0.0, (float(patient_meta.get("tissue_resistance_index", 1.0)) - 1.0) * 0.2)

    total_w = w_wound + w_pain + w_temp + w_tri
    overall_risk = round(min(1.0, (
        wound_risk * w_wound +
        pain_risk  * w_pain  +
        temp_risk  * w_temp  +
        tri_bonus  * w_tri
    ) / total_w), 3)

    risk_vector = {
        "tissue_resistance_index":  patient_meta.get("tissue_resistance_index", 1.0),
        "wound_score":              wound_score or 70,
        "wound_score_delta":        wound_delta,
        "pcps":                     pain_result.pcps,
        "keystroke_pain_index":     ks_pain or 0.0,
        "temperature":              float(temperature or 37.0),
        "temp_trend":               temp_trend,
        "healing_class":            patient_meta.get("healing_class", "class_ii_moderate"),
        "anomaly_flags":            json.loads(patient_meta.get("anomaly_flags", "[]") or "[]"),
        "day_post_op":              day_post_op,
        "overall_risk":             overall_risk,
        "wound_analysis_available": wound_available,
        "procedure_complexity":     patient_meta.get("procedure_complexity", 1),
    }

    # ── Step 7: Cascade DAG ───────────────────────────────────────────────────
    cascade_dag = await cascade_agent.build_cascade_dag(patient_id, risk_vector, day_post_op)

    # ── Step 8: Escalation check ──────────────────────────────────────────────
    evidence_brief = None
    escalated = False
    if overall_risk >= ESCALATION_RISK_THRESHOLD:
        log.info(f"Risk {overall_risk:.2f} >= threshold — escalating patient={patient_id}")
        evidence_brief = await escalation_agent.escalate_patient(
            patient_id,
            {**risk_vector, "day_post_op": day_post_op},
            cascade_dag.summary,
        )
        escalated = True

    log.info(f"Orchestrator complete: patient={patient_id} risk={overall_risk:.2f} escalated={escalated}")

    return {
        "patient_id":               patient_id,
        "day_post_op":              day_post_op,
        "pcps":                     pcps,
        "pk_corrected":             pk_corrected,
        "wound_score":              wound_score,
        "wound_flags":              json.dumps(wound_result.flags if wound_result else []),
        "wound_analysis_available": wound_available,
        "voice_pain_score":         voice_pain,
        "voice_confidence":         voice_conf,
        "keystroke_pain_index":     ks_pain,
        "keystroke_iki_mean":       keystroke_features.iki_mean if keystroke_features else None,
        "keystroke_error_rate":     keystroke_features.error_rate if keystroke_features else None,
        "overall_risk_score":       overall_risk,
        "cascade_dag":              cascade_dag.model_dump(),
        "evidence_brief":           evidence_brief.model_dump() if evidence_brief else None,
        "escalation_triggered":     escalated,
        "data_quality":             pain_result.data_quality,
        "wound_score_delta":        wound_delta,
        "temp_trend":               temp_trend,
    }
