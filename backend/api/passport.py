"""Surgical Passport generation and QR scan endpoints."""
import base64
import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.patient import Patient
from backend.models.passport import PassportRecord
from backend.services.passport import build_payload, sign_passport, verify_passport
from backend.services.risk_fingerprint import RiskFingerprint
from backend.utils.qr_generator import generate_passport_qr, qr_to_base64
from backend.utils.logger import get_logger

log = get_logger(__name__)
router = APIRouter()


@router.post("/generate/{patient_id}", status_code=201)
def generate_passport(patient_id: str, db: Session = Depends(get_db)):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    if not patient.risk_fingerprint_generated:
        raise HTTPException(status_code=400, detail="Risk Fingerprint not yet generated. Submit OR telemetry first.")

    # Build fingerprint object from patient record
    fingerprint = RiskFingerprint(
        tissue_resistance_index=patient.tissue_resistance_index or 1.0,
        suture_tension_score=2.0,
        blood_loss_class=patient.blood_loss_class or "minimal",
        anomaly_flags=json.loads(patient.anomaly_flags or "[]"),
        healing_class=patient.healing_class or "class_ii_moderate",
        procedure_risk_multiplier=1.0,
        data_quality="good",
        fingerprint_hash=patient.risk_fingerprint_hash or "0" * 64,
    )

    payload = build_payload(patient_id, {
        "procedure_type": patient.procedure_type,
        "procedure_date": patient.procedure_date,
        "robot_model": patient.robot_model or "da_vinci_xi",
    }, fingerprint)

    signed = sign_passport(payload)

    # Encode as base64 for QR
    passport_b64 = base64.b64encode(
        json.dumps({"payload": signed.payload_json, "sig": signed.signature_b64}).encode()
    ).decode()

    qr_path = generate_passport_qr(signed.fingerprint_hash, passport_b64, patient_id)
    qr_b64 = qr_to_base64(qr_path)

    record = PassportRecord(
        patient_id=patient_id,
        payload_json=signed.payload_json,
        signature_b64=signed.signature_b64,
        fingerprint_hash=signed.fingerprint_hash,
        qr_image_path=qr_path,
        signed_by=payload.signed_by,
    )
    db.add(record)
    db.commit()

    return {
        "passport_hash": signed.fingerprint_hash,
        "qr_image_base64": qr_b64,
        "qr_image_url": f"/static/qr/{qr_path.split('/')[-1]}",
        "payload": payload.model_dump(),
    }


@router.get("/scan/{fingerprint_hash}")
def scan_passport(fingerprint_hash: str, db: Session = Depends(get_db)):
    record = db.query(PassportRecord).filter(
        PassportRecord.fingerprint_hash == fingerprint_hash
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="Passport not found")

    valid = verify_passport(record.fingerprint_hash, record.signature_b64)
    if not valid:
        raise HTTPException(status_code=400, detail="Passport signature invalid")

    patient = db.query(Patient).filter(Patient.id == record.patient_id).first()
    payload = json.loads(record.payload_json)

    return {
        "valid": True,
        "patient_id": record.patient_id,
        "patient_name": patient.name if patient else "Unknown",
        "payload": payload,
        "signed_by": record.signed_by,
        "issued_at": record.created_at.isoformat(),
    }
