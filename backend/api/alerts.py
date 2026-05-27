"""Alerts — manual escalation trigger + federated learning demo."""
import json
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional

from backend.database import get_db
from backend.models.patient import Patient
from backend.models.risk import RiskScore
from backend.models.checkin import CheckIn
from backend.agents.escalation_agent import escalate_patient
from backend.services.federated import simulate_federated_round, get_network_status
from backend.utils.logger import get_logger

log = get_logger(__name__)
router = APIRouter()


@router.post("/escalate/{patient_id}")
async def manual_escalate(patient_id: str, db: Session = Depends(get_db)):
    """Manual demo trigger — escalate patient and send WhatsApp alert."""
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    latest_risk = (
        db.query(RiskScore)
        .filter(RiskScore.patient_id == patient_id)
        .order_by(RiskScore.created_at.desc())
        .first()
    )
    latest_checkin = (
        db.query(CheckIn)
        .filter(CheckIn.patient_id == patient_id)
        .order_by(CheckIn.created_at.desc())
        .first()
    )

    risk_data = {
        "overall_risk": latest_risk.overall_risk if latest_risk else 0.75,
        "wound_score": latest_checkin.wound_score if latest_checkin else 61,
        "pcps": latest_checkin.pcps if latest_checkin else 6.8,
        "keystroke_pain_index": latest_checkin.keystroke_pain_index if latest_checkin else 6.2,
        "temperature": latest_checkin.temperature if latest_checkin else 37.9,
        "day_post_op": latest_risk.day_post_op if latest_risk else 5,
        "healing_class": patient.healing_class or "class_ii_moderate",
    }

    cascade_summary = "Elevated wound tension progressing toward seroma formation."
    if latest_risk and latest_risk.cascade_dag_json:
        try:
            dag = json.loads(latest_risk.cascade_dag_json)
            cascade_summary = dag.get("summary", cascade_summary)
        except Exception:
            pass

    brief = await escalate_patient(patient_id, risk_data, cascade_summary)

    log.info(f"Manual escalation: patient={patient_id} urgency={brief.urgency}")
    return {"status": "escalated", "brief": brief.model_dump()}


@router.post("/federated/trigger")
def trigger_federated_round(node: str = "NodeA"):
    """Inject a new complication pattern and run federated averaging."""
    result = simulate_federated_round(new_pattern_hospital=node)
    return result.model_dump()


@router.get("/federated/status")
def federated_status():
    """Get current federated network node status."""
    return get_network_status()
