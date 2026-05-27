"""
Surgical Passport — ECDSA-signed portable patient profile.
Generates a cryptographically verified QR artifact from OR telemetry.
"""
import base64
import hashlib
import json
import os
from datetime import datetime
from typing import Optional

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.backends import default_backend
from pydantic import BaseModel

from backend.config import AEGIS_ECDSA_PRIVATE_KEY, AEGIS_ECDSA_PUBLIC_KEY, AEGIS_NODE_ID
from backend.utils.logger import get_logger

log = get_logger(__name__)


class PassportPayload(BaseModel):
    patient_id: str
    procedure_type: str
    procedure_date: str
    robot_model: str
    risk_fingerprint_hash: str
    tissue_resistance_index: float
    suture_tension_score: float
    blood_loss_class: str
    anomaly_flags: list[str]
    healing_class: str
    signed_by: str
    issued_at: str


class SignedPassport(BaseModel):
    payload: PassportPayload
    payload_json: str
    fingerprint_hash: str
    signature_b64: str


def _load_private_key() -> ec.EllipticCurvePrivateKey:
    """Load ECDSA private key from env variable (base64-encoded PEM)."""
    if AEGIS_ECDSA_PRIVATE_KEY:
        try:
            pem = base64.b64decode(AEGIS_ECDSA_PRIVATE_KEY)
            return serialization.load_pem_private_key(pem, password=None, backend=default_backend())
        except Exception as e:
            log.warning(f"Could not load ECDSA key from env: {e} — generating ephemeral key")

    # Generate ephemeral key for demo if not configured
    log.info("Generating ephemeral ECDSA key for demo (set AEGIS_ECDSA_PRIVATE_KEY for persistence)")
    return ec.generate_private_key(ec.SECP256R1(), default_backend())


def _load_public_key(private_key: ec.EllipticCurvePrivateKey) -> ec.EllipticCurvePublicKey:
    """Derive public key from private key (or load from env)."""
    if AEGIS_ECDSA_PUBLIC_KEY:
        try:
            pem = base64.b64decode(AEGIS_ECDSA_PUBLIC_KEY)
            return serialization.load_pem_public_key(pem, backend=default_backend())
        except Exception:
            pass
    return private_key.public_key()


_private_key = _load_private_key()
_public_key = _load_public_key(_private_key)


def sign_passport(payload: PassportPayload) -> SignedPassport:
    """Serialize payload → SHA-256 hash → ECDSA sign → return SignedPassport."""
    payload_json = json.dumps(payload.model_dump(), sort_keys=True)
    fingerprint_hash = hashlib.sha256(payload_json.encode()).hexdigest()

    signature = _private_key.sign(
        fingerprint_hash.encode(),
        ec.ECDSA(hashes.SHA256()),
    )
    signature_b64 = base64.b64encode(signature).decode()

    log.info(f"Passport signed: patient={payload.patient_id} hash={fingerprint_hash[:8]}... node={AEGIS_NODE_ID}")
    return SignedPassport(
        payload=payload,
        payload_json=payload_json,
        fingerprint_hash=fingerprint_hash,
        signature_b64=signature_b64,
    )


def verify_passport(fingerprint_hash: str, signature_b64: str) -> bool:
    """Verify ECDSA signature on a passport hash. Returns True if valid."""
    try:
        signature = base64.b64decode(signature_b64)
        _public_key.verify(signature, fingerprint_hash.encode(), ec.ECDSA(hashes.SHA256()))
        return True
    except Exception as e:
        log.warning(f"Passport verification failed: {e}")
        return False


def build_payload(patient_id: str, patient_data: dict, fingerprint) -> PassportPayload:
    """Construct a PassportPayload from patient record and Risk Fingerprint."""
    return PassportPayload(
        patient_id=patient_id,
        procedure_type=patient_data.get("procedure_type", "unknown"),
        procedure_date=patient_data.get("procedure_date", "unknown"),
        robot_model=patient_data.get("robot_model", "da_vinci_xi"),
        risk_fingerprint_hash=fingerprint.fingerprint_hash,
        tissue_resistance_index=fingerprint.tissue_resistance_index,
        suture_tension_score=fingerprint.suture_tension_score,
        blood_loss_class=fingerprint.blood_loss_class,
        anomaly_flags=fingerprint.anomaly_flags,
        healing_class=fingerprint.healing_class,
        signed_by=AEGIS_NODE_ID,
        issued_at=datetime.utcnow().isoformat() + "Z",
    )
