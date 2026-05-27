"""
Complication Cascade Agent — builds the forward-simulated causal DAG.
Uses Gemini API for clinical reasoning + scikit-learn GBM for probability prediction.
Falls back to _build_rule_based_cascade() using real patient data — never hardcoded.
"""
import json
import os
import pickle
from pathlib import Path
from typing import Optional

import google.generativeai as genai
from pydantic import BaseModel

from backend.config import GEMINI_MODEL, MAX_OUTPUT_TOKENS
from backend.utils.logger import get_logger
from backend.utils.json_utils import extract_json
from backend.utils.gemini_rate import acquire as gemini_acquire

log = get_logger(__name__)
MODEL_PATH = Path("ml/cascade_model/model.pkl")

SYSTEM_PROMPT = """You are a surgical complications AI. Given a patient risk vector, generate a Complication Cascade DAG.
Respond ONLY with valid JSON — no preamble, no markdown fences.

Schema:
{
  "nodes": [
    {
      "day": <int>,
      "event": "<snake_case_event_name>",
      "probability": <float 0.0-1.0>,
      "status": "<current|predicted|intervention_window|avoidable>",
      "intervention_flag": <bool>,
      "intervention_label": "<string or null>"
    }
  ],
  "summary": "<one sentence clinical summary>",
  "optimal_intervention_day": <int>
}

Rules:
- Include exactly one node with status "current" (day <= today)
- Include exactly one node with status "intervention_window" (intervention_flag=true, green node)
- Include at least one node with status "avoidable" (worst outcome if no intervention, red node)
- Day ordering must be chronological
- Probabilities must reflect the risk vector severity"""


class CascadeNode(BaseModel):
    day: int
    event: str
    probability: float
    status: str
    intervention_flag: bool
    intervention_label: Optional[str] = None


class CascadeDAG(BaseModel):
    nodes: list[CascadeNode]
    summary: str
    optimal_intervention_day: int
    data_quality: str = "good"


def _load_cascade_model():
    if MODEL_PATH.exists():
        try:
            with open(MODEL_PATH, "rb") as f:
                return pickle.load(f)
        except Exception as e:
            log.warning(f"Could not load cascade model.pkl: {e}")
    return None


_cascade_model = _load_cascade_model()


def _build_rule_based_cascade(risk_vector: dict, day_post_op: int) -> CascadeDAG:
    """
    Build a real Complication Cascade DAG from actual patient risk data.
    Uses clinical decision rules derived from the risk vector.
    No Gemini required. No hardcoded values. All outputs reflect this patient.
    Called when: Gemini API fails, rate limit hit, or JSON parse error.
    data_quality = "rule_based" so physician dashboard can show appropriate badge.
    """
    tri      = float(risk_vector.get("tissue_resistance_index", 1.0))
    wound    = float(risk_vector.get("wound_score") or 70)
    pcps     = float(risk_vector.get("pcps") or 5.0)
    temp     = float(risk_vector.get("temperature") or 37.0)
    overall  = float(risk_vector.get("overall_risk", 0.4))
    anomalies = risk_vector.get("anomaly_flags", [])
    w_delta  = float(risk_vector.get("wound_score_delta", 0.0))
    t_trend  = float(risk_vector.get("temp_trend", 0.0))

    nodes: list[CascadeNode] = []

    # ── Node 1: Current state ─────────────────────────────────────────────
    if wound < 55:      current_event = "severe_wound_deterioration"
    elif wound < 65:    current_event = "elevated_wound_tension"
    elif wound < 80:    current_event = "wound_healing_suboptimal"
    else:               current_event = "normal_recovery_progress"

    nodes.append(CascadeNode(day=day_post_op, event=current_event, probability=1.0,
                             status="current", intervention_flag=False))

    # ── Node 2: Intervention window ───────────────────────────────────────
    if overall >= 0.75:
        intervention_offset, action_label = 0, "Emergency teleconsult today"
    elif overall >= 0.60:
        intervention_offset, action_label = 1, "Schedule teleconsult within 24 hours"
    elif overall >= 0.45:
        intervention_offset, action_label = 2, "Schedule teleconsult within 48 hours"
    else:
        intervention_offset, action_label = 3, "Increase check-in frequency"

    intervention_day  = day_post_op + intervention_offset
    prevention_prob   = round(min(0.95, 0.60 + overall * 0.35), 2)

    nodes.append(CascadeNode(day=intervention_day, event="teleconsult_intervention",
                             probability=prevention_prob, status="intervention_window",
                             intervention_flag=True, intervention_label=action_label))

    # ── Node 3: Near-term predicted complication ──────────────────────────
    near_day = day_post_op + 2
    if t_trend > 0.5 or temp > 38.0:
        near_event = "inflammatory_cascade"
        near_prob  = round(min(0.90, 0.40 + t_trend * 0.15 + (temp - 37.0) * 0.12), 2)
    elif w_delta < -8 and tri > 1.1:
        near_event = "lymphatic_disruption"
        near_prob  = round(min(0.88, 0.38 + abs(w_delta) * 0.015 + (tri - 1.0) * 0.25), 2)
    elif wound < 60 and pcps > 6:
        near_event = "wound_dehiscence_risk"
        near_prob  = round(min(0.82, 0.35 + (60 - wound) * 0.012 + (pcps - 5) * 0.04), 2)
    elif anomalies:
        near_event = "anomaly_complication_progression"
        near_prob  = round(min(0.78, 0.40 + len(anomalies) * 0.10), 2)
    else:
        near_event = "delayed_wound_closure"
        near_prob  = round(min(0.70, 0.25 + overall * 0.45), 2)

    nodes.append(CascadeNode(day=near_day, event=near_event, probability=near_prob,
                             status="predicted", intervention_flag=False))

    # ── Node 4: Mid-term complication ─────────────────────────────────────
    mid_day  = day_post_op + 5
    mid_prob = round(near_prob * 0.80, 2)
    mid_map  = {
        "lymphatic_disruption":             "seroma_formation",
        "inflammatory_cascade":             "infection_risk_elevated",
        "wound_dehiscence_risk":            "partial_dehiscence",
        "anomaly_complication_progression": "hematoma_risk",
        "delayed_wound_closure":            "chronic_wound_risk",
        "severe_wound_deterioration":       "surgical_site_infection",
        "elevated_wound_tension":           "seroma_formation",
    }
    mid_event = mid_map.get(near_event, "complication_progression")
    nodes.append(CascadeNode(day=mid_day, event=mid_event, probability=mid_prob,
                             status="predicted", intervention_flag=False))

    # ── Node 5: Worst-case avoidable outcome ─────────────────────────────
    worst_day  = day_post_op + 9
    worst_prob = round(mid_prob * 0.82, 2)
    if tri > 1.2 or overall >= 0.70:        worst_event = "surgical_site_infection"
    elif pcps > 7:                           worst_event = "uncontrolled_pain_readmission"
    elif temp > 38.0 or t_trend > 0.8:     worst_event = "sepsis_risk"
    else:                                   worst_event = "readmission_risk"

    nodes.append(CascadeNode(day=worst_day, event=worst_event, probability=worst_prob,
                             status="avoidable", intervention_flag=False,
                             intervention_label=f"Avoidable — {action_label.lower()}"))

    # ── Summary from real values ──────────────────────────────────────────
    trend_str = f"Wound deteriorating {abs(w_delta):.0f}pts/day. " if w_delta < -5 else ""
    temp_str  = f"Temperature trending up ({t_trend:+.1f}°C). " if t_trend > 0.3 else ""
    summary = (
        f"Day {day_post_op} post-op. Overall risk {round(overall * 100)}%. "
        f"Wound {wound:.0f}/100. PCPS {pcps:.1f}/10. "
        f"{trend_str}{temp_str}"
        f"Intervention at Day {intervention_day} prevents {worst_event.replace('_', ' ')}."
    )

    return CascadeDAG(
        nodes=sorted(nodes, key=lambda n: n.day),
        summary=summary,
        optimal_intervention_day=intervention_day,
        data_quality="rule_based",
    )


async def build_cascade_dag(
    patient_id: str,
    risk_vector: dict,
    day_post_op: int,
) -> CascadeDAG:
    """
    Build Complication Cascade DAG from patient risk vector.
    1. Runs trained GBM model.pkl for complication probabilities.
    2. Passes ML predictions + raw signals to Gemini for clinical DAG reasoning.
    3. Falls back to rule-based cascade from real patient data if either fails.
    """
    # ── Step 1: ML model predictions ─────────────────────────────────────────
    ml_probs = {}
    if _cascade_model is not None:
        try:
            from ml.cascade_model.train import predict
            ml_probs = predict(_cascade_model, {
                "tissue_resistance_index": risk_vector.get("tissue_resistance_index", 1.0),
                "wound_score_delta":       risk_vector.get("wound_score_delta", 0),
                "pcps":                    risk_vector.get("pcps", 5.0),
                "days_post_op":            float(day_post_op),
                "procedure_complexity":    risk_vector.get("procedure_complexity", 1),
                "temp_trend":              risk_vector.get("temp_trend", 0.0),
            })
            log.info(f"ML cascade probs: SSI={ml_probs.get('surgical_site_infection', '?')}")
        except Exception as e:
            log.warning(f"ML model prediction failed: {e}")

    # ── Step 2: Rate limit check ──────────────────────────────────────────────
    if not gemini_acquire():
        log.warning("Gemini rate limited — using rule-based cascade")
        return _build_rule_based_cascade(risk_vector, day_post_op)

    # ── Step 3: Gemini clinical DAG reasoning ─────────────────────────────────
    try:
        model = genai.GenerativeModel(
            model_name=GEMINI_MODEL,
            generation_config=genai.types.GenerationConfig(
                max_output_tokens=MAX_OUTPUT_TOKENS,
                temperature=0.2,
            ),
            system_instruction=SYSTEM_PROMPT,
        )

        ml_section = ""
        if ml_probs:
            ml_section = f"""
ML Model Predictions (GBM — use as probability anchors):
- Elevated Wound Tension:  {ml_probs.get('elevated_wound_tension', 'N/A')}
- Lymphatic Disruption:    {ml_probs.get('lymphatic_disruption', 'N/A')}
- Seroma Formation:        {ml_probs.get('seroma_formation', 'N/A')}
- Surgical Site Infection: {ml_probs.get('surgical_site_infection', 'N/A')}
- Delayed Healing:         {ml_probs.get('delayed_healing', 'N/A')}
- Anastomosis Leak:        {ml_probs.get('anastomosis_leak', 'N/A')}
- Hematoma:                {ml_probs.get('hematoma', 'N/A')}
"""

        prompt = f"""Patient risk vector (Day {day_post_op} post-op):
- Tissue Resistance Index: {risk_vector.get('tissue_resistance_index', 1.0)}
- Wound Score: {risk_vector.get('wound_score', 70)} / 100
- Wound Score Delta: {risk_vector.get('wound_score_delta', 0)} (negative=deteriorating)
- Voice Pain PCPS: {risk_vector.get('pcps', 5.0)} / 10
- Keystroke Pain Index: {risk_vector.get('keystroke_pain_index', 4.0)} / 10
- Temperature: {risk_vector.get('temperature', 37.0)} °C  (trend: {risk_vector.get('temp_trend', 0):+.1f})
- Healing Class: {risk_vector.get('healing_class', 'class_ii_moderate')}
- Anomaly Flags: {risk_vector.get('anomaly_flags', [])}
- Current Day Post-Op: {day_post_op}
{ml_section}
Generate the Complication Cascade DAG. Use ML predictions as probability anchors."""

        response = model.generate_content(prompt)
        data = extract_json(response.text)
        nodes = [CascadeNode(**n) for n in data["nodes"]]
        for n in nodes:
            n.probability = max(0.0, min(1.0, n.probability))

        dag = CascadeDAG(
            nodes=nodes,
            summary=data.get("summary", ""),
            optimal_intervention_day=data.get("optimal_intervention_day", day_post_op + 1),
            data_quality="good",
        )
        log.info(f"Cascade DAG built: {len(nodes)} nodes, intervention_day={dag.optimal_intervention_day}")
        return dag

    except Exception as exc:
        log.error(f"Cascade agent failed: {exc} — using rule-based fallback")
        return _build_rule_based_cascade(risk_vector, day_post_op)
