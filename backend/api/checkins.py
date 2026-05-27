"""Check-in submission endpoints."""
import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session

from backend.database import get_db, SessionLocal
from backend.models.checkin import CheckIn
from backend.models.patient import Patient
from backend.models.risk import RiskScore
from backend.agents.orchestrator import process_checkin
from backend.utils.logger import get_logger

log = get_logger(__name__)
router = APIRouter()


class KeystrokeSubmit(BaseModel):
    patient_id: str
    window_start_ms: int
    events: list[dict]
    total_keystrokes: int


class CheckInSubmit(BaseModel):
    patient_id: str
    day_post_op: int
    temperature: Optional[float] = None
    spo2: Optional[float] = None
    raw_pain_score: Optional[float] = None
    medication_drug: Optional[str] = None
    medication_hours_since_dose: Optional[float] = None
    keystroke_window: Optional[dict] = None

    @field_validator("day_post_op")
    @classmethod
    def validate_day(cls, v):
        if not (0 <= v <= 365):
            raise ValueError("day_post_op must be 0–365")
        return v

    @field_validator("raw_pain_score")
    @classmethod
    def validate_pain(cls, v):
        if v is not None and not (0.0 <= v <= 10.0):
            raise ValueError("raw_pain_score must be 0–10")
        return v

    @field_validator("temperature")
    @classmethod
    def validate_temp(cls, v):
        if v is not None and not (34.0 <= v <= 42.5):
            raise ValueError("temperature must be 34–42.5°C")
        return v

    @field_validator("spo2")
    @classmethod
    def validate_spo2(cls, v):
        if v is not None and not (70.0 <= v <= 100.0):
            raise ValueError("spo2 must be 70–100%")
        return v

    @field_validator("medication_hours_since_dose")
    @classmethod
    def validate_hours(cls, v):
        if v is not None and not (0.0 <= v <= 72.0):
            raise ValueError("hours_since_dose must be 0–72")
        return v


def _risk_level(score: float) -> str:
    if score >= 0.75:
        return "critical"
    elif score >= 0.55:
        return "high"
    elif score >= 0.35:
        return "medium"
    return "low"


async def _run_pipeline(
    patient_id: str,
    checkin_id: int,
    checkin_data: dict,
    patient_meta: dict,
):
    """
    Background task — creates its OWN DB session.
    Never shares the request session (which is closed before this runs).
    """
    db = SessionLocal()
    try:
        result = await process_checkin(patient_id, checkin_data, patient_meta)

        db.query(CheckIn).filter(CheckIn.id == checkin_id).update({
            "pcps":                     result.get("pcps"),
            "pk_corrected":             result.get("pk_corrected", False),
            "wound_score":              result.get("wound_score"),
            "wound_flags":              result.get("wound_flags", "[]"),
            "wound_analysis_available": result.get("wound_analysis_available", False),
            "voice_pain_score":         result.get("voice_pain_score"),
            "voice_confidence":         result.get("voice_confidence"),
            "keystroke_pain_index":     result.get("keystroke_pain_index"),
            "overall_risk_score":       result.get("overall_risk_score"),
            "data_quality":             result.get("data_quality", "normal"),
        })

        cascade_dag = result.get("cascade_dag")
        risk = RiskScore(
            patient_id=patient_id,
            day_post_op=checkin_data.get("day_post_op", 1),
            overall_risk=result.get("overall_risk_score", 0.0),
            risk_level=_risk_level(result.get("overall_risk_score", 0.0)),
            wound_component=(result.get("wound_score") or 50) / 100,
            pain_component=(result.get("keystroke_pain_index") or 0) / 10,
            cascade_dag_json=json.dumps(cascade_dag) if cascade_dag else None,
            escalation_triggered=result.get("escalation_triggered", False),
            evidence_brief=json.dumps(result.get("evidence_brief"))
                           if result.get("evidence_brief") else None,
        )
        db.add(risk)
        db.commit()
        log.info(
            f"Pipeline complete: patient={patient_id} "
            f"risk={result.get('overall_risk_score', 0):.2f}"
        )
    except Exception as e:
        log.error(f"Pipeline failed for patient={patient_id}: {e}")
        db.rollback()
    finally:
        db.close()   # always close — this session is owned by the task


@router.post("/", status_code=202)
async def submit_checkin(
    body: CheckInSubmit,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    patient = db.query(Patient).filter(Patient.id == body.patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    checkin = CheckIn(
        patient_id=body.patient_id,
        day_post_op=body.day_post_op,
        temperature=body.temperature,
        spo2=body.spo2,
        raw_pain_score=body.raw_pain_score,
        medication_drug=body.medication_drug,
        medication_hours_since_dose=body.medication_hours_since_dose,
    )
    db.add(checkin)
    db.commit()
    db.refresh(checkin)

    patient_meta = {
        "tissue_resistance_index": patient.tissue_resistance_index,
        "healing_class":           patient.healing_class,
        "anomaly_flags":           patient.anomaly_flags,
    }

    background_tasks.add_task(
        _run_pipeline,
        body.patient_id,
        checkin.id,
        body.model_dump(),
        patient_meta,
        # NO db parameter — task creates its own session
    )
    return {
        "checkin_id": checkin.id,
        "status": "accepted",
        "message": "Processing in background",
    }


@router.post("/wound")
async def submit_wound_image(
    patient_id: str = Form(...),
    day_post_op: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Upload a wound image — runs Gemini vision analysis immediately."""
    from backend.agents.wound_agent import analyze_wound
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    image_bytes = await file.read()
    mime = file.content_type or "image/jpeg"
    result = await analyze_wound(image_bytes, mime)

    checkin = CheckIn(
        patient_id=patient_id,
        day_post_op=day_post_op,
        wound_score=result.wound_score,
        wound_flags=json.dumps(result.flags),
        wound_analysis_available=result.data_quality != "unavailable",
        data_quality=result.data_quality,
    )
    db.add(checkin)
    db.commit()
    return result.model_dump()


@router.post("/keystroke")
def submit_keystroke(body: KeystrokeSubmit, db: Session = Depends(get_db)):
    """Receive a 30-minute keystroke timing window."""
    from backend.services.keystroke import extract_features, KeystrokeWindow
    kw = KeystrokeWindow(**body.model_dump())
    features = extract_features(kw)
    if features:
        log.info(f"Keystroke window: patient={body.patient_id} pain_index={features.pain_index}")
        return {"pain_index": features.pain_index, "iki_mean": features.iki_mean}
    return {"pain_index": None, "message": "Insufficient data"}


@router.post("/voice")
async def submit_voice(
    patient_id: str = Form(...),
    day_post_op: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Upload a voice clip — runs librosa acoustic pain analysis."""
    from backend.services.voice import extract_voice_features
    import asyncio

    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    audio_bytes = await file.read()
    filename = file.filename or "audio.webm"
    result = await asyncio.to_thread(extract_voice_features, audio_bytes, filename)

    if result is None:
        return {
            "pain_score": None,
            "confidence": 0.0,
            "message": "Audio too short or unreadable — minimum 3 seconds required.",
            "data_quality": "degraded",
        }

    checkin = CheckIn(
        patient_id=patient_id,
        day_post_op=day_post_op,
        voice_pain_score=result.pain_score,
        voice_confidence=result.confidence,
        data_quality="partial",
    )
    db.add(checkin)
    db.commit()
    log.info(f"Voice analysis: patient={patient_id} pain={result.pain_score} conf={result.confidence}")
    return result.model_dump()


@router.get("/latest/{patient_id}")
def get_latest_checkin(patient_id: str, db: Session = Depends(get_db)):
    """Return the most recent check-in record for a patient."""
    checkin = (
        db.query(CheckIn)
        .filter(CheckIn.patient_id == patient_id)
        .order_by(CheckIn.created_at.desc())
        .first()
    )
    if not checkin:
        raise HTTPException(status_code=404, detail="No check-ins found")
    return {
        "id": checkin.id,
        "patient_id": checkin.patient_id,
        "day_post_op": checkin.day_post_op,
        "temperature": checkin.temperature,
        "spo2": checkin.spo2,
        "raw_pain_score": checkin.raw_pain_score,
        "pcps": checkin.pcps,
        "pk_corrected": checkin.pk_corrected,
        "wound_score": checkin.wound_score,
        "wound_flags": checkin.wound_flags,
        "voice_pain_score": checkin.voice_pain_score,
        "keystroke_pain_index": checkin.keystroke_pain_index,
        "overall_risk_score": checkin.overall_risk_score,
        "data_quality": checkin.data_quality,
        "created_at": checkin.created_at.isoformat() if checkin.created_at else None,
    }
