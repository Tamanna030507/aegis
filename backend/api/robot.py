"""Simulated OR telemetry ingestion endpoint."""
import json
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional

from backend.database import get_db
from backend.models.patient import Patient
from backend.services.risk_fingerprint import generate_fingerprint
from backend.utils.logger import get_logger

log = get_logger(__name__)
router = APIRouter()


class TelemetryPayload(BaseModel):
    patient_id: str
    procedure_type: str
    robot_model: Optional[str] = "da_vinci_xi"
    tissue_resistance_index: Optional[float] = None
    suture_tension_score: Optional[float] = None
    blood_loss_ml: Optional[float] = None
    procedure_duration_min: Optional[float] = None
    irrigation_events: Optional[int] = None
    retraction_events: Optional[int] = None
    anomaly_flags: Optional[list[str]] = None
    raw_telemetry: Optional[dict] = None


@router.post("/telemetry", status_code=200)
def ingest_telemetry(body: TelemetryPayload, db: Session = Depends(get_db)):
    """
    Receive simulated OR robot telemetry and generate the patient's Risk Fingerprint.
    This is called once per patient immediately post-surgery.
    """
    patient = db.query(Patient).filter(Patient.id == body.patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    telemetry = body.model_dump(exclude={"patient_id", "raw_telemetry"})
    if body.raw_telemetry:
        telemetry.update(body.raw_telemetry)

    fingerprint = generate_fingerprint(telemetry)

    # Persist fingerprint to patient record
    patient.tissue_resistance_index = fingerprint.tissue_resistance_index
    patient.suture_tension_score = fingerprint.suture_tension_score
    patient.blood_loss_class = fingerprint.blood_loss_class
    patient.anomaly_flags = json.dumps(fingerprint.anomaly_flags)
    patient.healing_class = fingerprint.healing_class
    patient.risk_fingerprint_hash = fingerprint.fingerprint_hash
    patient.risk_fingerprint_generated = True
    patient.robot_model = body.robot_model

    db.commit()

    log.info(f"Telemetry ingested: patient={body.patient_id} healing={fingerprint.healing_class}")
    return {
        "patient_id": body.patient_id,
        "risk_fingerprint": fingerprint.model_dump(),
        "message": "Surgical Risk Fingerprint generated. The robot just wrote the recovery plan.",
    }
