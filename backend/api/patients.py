"""Patient CRUD routes."""
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.patient import Patient
from backend.utils.logger import get_logger

log = get_logger(__name__)
router = APIRouter()


class PatientCreate(BaseModel):
    name: str
    procedure_type: str
    procedure_date: str
    robot_model: Optional[str] = "da_vinci_xi"
    attending_physician: Optional[str] = None
    date_of_birth: Optional[str] = None


class PatientResponse(BaseModel):
    id: str
    name: str
    procedure_type: str
    procedure_date: str
    robot_model: Optional[str]
    attending_physician: Optional[str]
    risk_fingerprint_generated: bool
    healing_class: Optional[str]
    tissue_resistance_index: Optional[float]

    class Config:
        from_attributes = True


@router.post("/", response_model=PatientResponse, status_code=201)
def create_patient(body: PatientCreate, db: Session = Depends(get_db)):
    patient = Patient(id=str(uuid.uuid4()), **body.model_dump())
    db.add(patient)
    db.commit()
    db.refresh(patient)
    log.info(f"Patient created: id={patient.id}")
    return patient


@router.get("/", response_model=list[PatientResponse])
def list_patients(db: Session = Depends(get_db)):
    return db.query(Patient).all()


@router.get("/{patient_id}", response_model=PatientResponse)
def get_patient(patient_id: str, db: Session = Depends(get_db)):
    p = db.query(Patient).filter(Patient.id == patient_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Patient not found")
    return p


@router.get("/{patient_id}/timeline")
def get_patient_timeline(patient_id: str, db: Session = Depends(get_db)):
    """Full per-day timeline for the physician dashboard recovery curve chart."""
    from backend.models.checkin import CheckIn
    from backend.models.risk import RiskScore

    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(404, "Patient not found")

    checkins = (
        db.query(CheckIn)
        .filter(CheckIn.patient_id == patient_id)
        .order_by(CheckIn.created_at.asc())
        .all()
    )
    risks = (
        db.query(RiskScore)
        .filter(RiskScore.patient_id == patient_id)
        .order_by(RiskScore.created_at.asc())
        .all()
    )

    days: dict[int, dict] = {}
    for c in checkins:
        d = c.day_post_op or 0
        if d not in days:
            days[d] = {"day": d}
        days[d].update({
            "wound_score":          c.wound_score,
            "pcps":                 c.pcps,
            "temperature":          c.temperature,
            "voice_pain_score":     c.voice_pain_score,
            "keystroke_pain_index": c.keystroke_pain_index,
        })

    for r in risks:
        d = r.day_post_op or 0
        if d not in days:
            days[d] = {"day": d}
        days[d].update({
            "overall_risk": r.overall_risk,
            "risk_level":   r.risk_level,
            "escalated":    r.escalation_triggered,
        })

    return sorted(days.values(), key=lambda x: x["day"])

