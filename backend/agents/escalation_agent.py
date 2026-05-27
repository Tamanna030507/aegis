"""
Escalation Agent — generates Evidence Briefs and triggers physician alerts.
Invoked when patient risk crosses escalation threshold.
Falls back to _build_rule_based_brief() using real patient data — no hardcoded values.
"""
import json
from typing import Optional

import google.generativeai as genai
from pydantic import BaseModel

from backend.config import GEMINI_MODEL, MAX_OUTPUT_TOKENS
from backend.utils.logger import get_logger
from backend.utils.json_utils import extract_json
from backend.utils.gemini_rate import acquire as gemini_acquire
from backend.utils.whatsapp import send_whatsapp_alert

log = get_logger(__name__)

SYSTEM_PROMPT = """You are a clinical AI assistant generating physician escalation briefs.
Given a patient's current risk data, generate a concise Evidence Brief.
Respond ONLY with valid JSON — no preamble, no markdown fences.

Schema:
{
  "title": "<Brief title, e.g. 'HIGH RISK — Patient 0047 Requires Immediate Review'>",
  "risk_summary": "<2-3 sentence risk summary for physician>",
  "key_signals": ["<signal 1>", "<signal 2>", "<signal 3>"],
  "recommended_action": "<specific physician action>",
  "urgency": "<immediate|urgent|monitor>",
  "whatsapp_message": "<concise WhatsApp message under 160 chars>"
}"""


class EvidenceBrief(BaseModel):
    title: str
    risk_summary: str
    key_signals: list[str]
    recommended_action: str
    urgency: str
    whatsapp_message: str
    data_quality: str = "good"


def _build_rule_based_brief(patient_id: str, risk_data: dict) -> EvidenceBrief:
    """
    Build a real Evidence Brief from actual patient data.
    Every value comes from risk_data — nothing is invented or hardcoded.
    Called when: Gemini fails, rate limit hit, or JSON parse error.
    """
    risk    = float(risk_data.get("overall_risk", 0.0))
    wound   = risk_data.get("wound_score")
    pcps    = risk_data.get("pcps")
    ks      = risk_data.get("keystroke_pain_index")
    temp    = risk_data.get("temperature")
    day     = risk_data.get("day_post_op", "?")
    cascade = risk_data.get("cascade_summary", "")
    healing = risk_data.get("healing_class", "unknown")
    w_delta = risk_data.get("wound_score_delta")

    if risk >= 0.75:
        urgency, action, title_prefix = "immediate", "Contact patient within 2 hours for emergency teleconsult", "CRITICAL RISK"
    elif risk >= 0.55:
        urgency, action, title_prefix = "urgent", "Schedule teleconsult within 12 hours", "HIGH RISK"
    else:
        urgency, action, title_prefix = "monitor", "Increase check-in frequency to twice daily", "ELEVATED RISK"

    signals: list[str] = []
    if wound is not None:
        trend = ""
        if w_delta is not None:
            trend = f", {'↓' if w_delta < 0 else '↑'}{abs(w_delta):.0f}pts today"
        level = "critical" if wound < 55 else "concerning" if wound < 70 else "stable"
        signals.append(f"Wound score {wound}/100 ({level}{trend})")
    if pcps is not None:
        lvl = "critical" if pcps >= 7.5 else "elevated" if pcps >= 5.5 else "normal"
        signals.append(f"Pain PCPS {pcps:.1f}/10 ({lvl})")
    if ks is not None:
        signals.append(f"Keystroke pain index {ks:.1f}/10 (passive biomarker)")
    if temp is not None and temp > 37.5:
        signals.append(f"Temperature {temp:.1f}°C — approaching fever threshold")
    elif temp is not None:
        signals.append(f"Temperature {temp:.1f}°C — normal range")
    if not signals:
        signals = [f"Overall risk score {round(risk * 100)}% — exceeds escalation threshold"]

    risk_pct = round(risk * 100)
    summary = (
        f"Patient {patient_id} — Day {day} post-op. "
        f"Overall risk {risk_pct}% (healing class: {healing.replace('_', ' ')}). "
        f"{'; '.join(signals[:3])}. "
        f"{cascade if cascade else 'Cascade analysis pending.'}"
    )

    wa_parts = []
    if wound is not None: wa_parts.append(f"Wound {wound}/100")
    if pcps  is not None: wa_parts.append(f"Pain {pcps:.1f}/10")
    wa_body = " | ".join(wa_parts)
    whatsapp = (
        f"AEGIS ALERT — Patient {patient_id} | Risk {risk_pct}% | "
        f"Day {day} | {wa_body} | {urgency.upper()} — {action[:40]}"
    )[:160]

    return EvidenceBrief(
        title=f"{title_prefix} — Patient {patient_id} | Day {day} Post-Op",
        risk_summary=summary,
        key_signals=signals,
        recommended_action=action,
        urgency=urgency,
        whatsapp_message=whatsapp,
        data_quality="rule_based",
    )


async def generate_evidence_brief(
    patient_id: str,
    risk_data: dict,
    cascade_summary: str,
) -> EvidenceBrief:
    """Generate Evidence Brief — Gemini primary, rule-based fallback from real data."""
    risk_data["cascade_summary"] = cascade_summary

    if not gemini_acquire():
        log.warning("Gemini rate limited — rule-based evidence brief")
        return _build_rule_based_brief(patient_id, risk_data)

    try:
        model = genai.GenerativeModel(
            model_name=GEMINI_MODEL,
            generation_config=genai.types.GenerationConfig(
                max_output_tokens=MAX_OUTPUT_TOKENS,
                temperature=0.3,
            ),
            system_instruction=SYSTEM_PROMPT,
        )

        prompt = f"""Generate an Evidence Brief for Patient {patient_id}.

Current Risk Data:
- Overall Risk Score: {risk_data.get('overall_risk', 0):.2f}
- Wound Score: {risk_data.get('wound_score', 'N/A')} / 100
- Pain PCPS: {risk_data.get('pcps', 'N/A')} / 10
- Keystroke Pain Index: {risk_data.get('keystroke_pain_index', 'N/A')} / 10
- Temperature: {risk_data.get('temperature', 'N/A')} °C
- Day Post-Op: {risk_data.get('day_post_op', 'N/A')}
- Cascade Summary: {cascade_summary}
- Healing Class: {risk_data.get('healing_class', 'unknown')}"""

        response = model.generate_content(prompt)
        data  = extract_json(response.text)
        brief = EvidenceBrief(**data)
        log.info(f"Evidence Brief generated for patient={patient_id} urgency={brief.urgency}")
        return brief

    except Exception as exc:
        log.error(f"Escalation agent failed: {exc} — rule-based brief")
        return _build_rule_based_brief(patient_id, risk_data)


async def escalate_patient(
    patient_id: str,
    risk_data: dict,
    cascade_summary: str,
    physician_phone: Optional[str] = None,
) -> EvidenceBrief:
    """Full escalation flow: generate brief → send WhatsApp → push WebSocket."""
    brief = await generate_evidence_brief(patient_id, risk_data, cascade_summary)

    # Send WhatsApp — failure is non-fatal
    alert_sent = await send_whatsapp_alert(brief.whatsapp_message, to=physician_phone)
    if alert_sent:
        log.info(f"Physician alerted via WhatsApp for patient={patient_id}")
    else:
        log.warning(f"WhatsApp alert not sent for patient={patient_id}")

    # Push to connected physician dashboards via WebSocket
    try:
        from backend.api.ws import broadcast_escalation
        await broadcast_escalation(patient_id, brief.model_dump())
    except Exception as e:
        log.debug(f"WebSocket broadcast skipped: {e}")

    return brief
