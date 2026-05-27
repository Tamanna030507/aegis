"""Risk score + Cascade Graph endpoints — optimized N+1 query fix."""
import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.patient import Patient
from backend.models.risk import RiskScore
from backend.models.checkin import CheckIn
from backend.utils.logger import get_logger

log = get_logger(__name__)
router = APIRouter()


@router.get("/queue/all")
def get_risk_queue(db: Session = Depends(get_db)):
    """Return all patients sorted by risk — optimised to 2 queries (was N+1)."""
    patients = db.query(Patient).all()
    if not patients:
        return []

    # Single subquery for latest risk score per patient
    subq = (
        db.query(
            RiskScore.patient_id,
            func.max(RiskScore.created_at).label("latest_at"),
        )
        .group_by(RiskScore.patient_id)
        .subquery()
    )
    latest_scores = (
        db.query(RiskScore)
        .join(
            subq,
            (RiskScore.patient_id == subq.c.patient_id) &
            (RiskScore.created_at  == subq.c.latest_at),
        )
        .all()
    )
    score_map = {r.patient_id: r for r in latest_scores}

    queue = [
        {
            "patient_id":           p.id,
            "name":                 p.name,
            "procedure_type":       p.procedure_type,
            "overall_risk":         score_map[p.id].overall_risk    if p.id in score_map else 0.0,
            "risk_level":           score_map[p.id].risk_level      if p.id in score_map else "low",
            "day_post_op":          score_map[p.id].day_post_op     if p.id in score_map else 0,
            "escalation_triggered": score_map[p.id].escalation_triggered if p.id in score_map else False,
        }
        for p in patients
    ]
    queue.sort(key=lambda x: x["overall_risk"], reverse=True)
    return queue


@router.get("/{patient_id}")
def get_risk(patient_id: str, db: Session = Depends(get_db)):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    latest = (
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

    return {
        "patient_id":           patient_id,
        "overall_risk":         latest.overall_risk         if latest else 0.0,
        "risk_level":           latest.risk_level           if latest else "low",
        "wound_component":      latest.wound_component      if latest else None,
        "pain_component":       latest.pain_component       if latest else None,
        "wound_score":          latest_checkin.wound_score  if latest_checkin else None,
        "pcps":                 latest_checkin.pcps         if latest_checkin else None,
        "keystroke_pain_index": latest_checkin.keystroke_pain_index if latest_checkin else None,
        "temperature":          latest_checkin.temperature  if latest_checkin else None,
        "escalation_triggered": latest.escalation_triggered if latest else False,
        "day_post_op":          latest.day_post_op          if latest else 0,
        "healing_class":        patient.healing_class,
        "data_quality":         latest_checkin.data_quality if latest_checkin else "normal",
    }


@router.get("/{patient_id}/cascade")
def get_cascade(patient_id: str, db: Session = Depends(get_db)):
    latest = (
        db.query(RiskScore)
        .filter(RiskScore.patient_id == patient_id)
        .order_by(RiskScore.created_at.desc())
        .first()
    )

    if not latest or not latest.cascade_dag_json:
        # Build rule-based fallback from actual patient data instead of hardcoded 0047
        patient = db.query(Patient).filter(Patient.id == patient_id).first()
        latest_ci = (
            db.query(CheckIn)
            .filter(CheckIn.patient_id == patient_id)
            .order_by(CheckIn.created_at.desc())
            .first()
        )
        from backend.agents.cascade_agent import _build_rule_based_cascade
        rv = {
            "tissue_resistance_index": patient.tissue_resistance_index if patient else 1.0,
            "wound_score": latest_ci.wound_score if latest_ci else 70,
            "pcps": latest_ci.pcps if latest_ci else 5.0,
            "temperature": latest_ci.temperature if latest_ci else 37.0,
            "overall_risk": latest.overall_risk if latest else 0.4,
            "anomaly_flags": [],
            "wound_score_delta": 0.0,
            "temp_trend": 0.0,
        }
        day = latest.day_post_op if latest else (latest_ci.day_post_op if latest_ci else 5)
        return _build_rule_based_cascade(rv, day).model_dump()

    return json.loads(latest.cascade_dag_json)


@router.get("/{patient_id}/history")
def get_risk_history(patient_id: str, db: Session = Depends(get_db)):
    scores = (
        db.query(RiskScore)
        .filter(RiskScore.patient_id == patient_id)
        .order_by(RiskScore.created_at.asc())
        .all()
    )
    checkins = (
        db.query(CheckIn)
        .filter(CheckIn.patient_id == patient_id)
        .order_by(CheckIn.created_at.asc())
        .all()
    )
    return {
        "risk_history": [
            {"day": s.day_post_op, "overall_risk": s.overall_risk, "risk_level": s.risk_level}
            for s in scores
        ],
        "wound_history": [
            {"day": c.day_post_op, "wound_score": c.wound_score, "pcps": c.pcps}
            for c in checkins if c.wound_score is not None
        ],
    }
