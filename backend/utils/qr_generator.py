"""QR code generation utility for Surgical Passports."""
import base64
import io
import os
from pathlib import Path

import qrcode
from PIL import Image

from backend.utils.logger import get_logger

log = get_logger(__name__)

QR_DIR = Path("static/qr")
QR_DIR.mkdir(parents=True, exist_ok=True)


def generate_passport_qr(passport_hash: str, payload_b64: str, patient_id: str) -> str:
    """
    Generate a QR code encoding the signed Surgical Passport.
    Returns the path to the saved PNG file.
    The QR encodes: aegis://passport/<base64_payload>
    """
    qr_data = f"aegis://passport/{payload_b64}"

    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=4,
    )
    qr.add_data(qr_data)
    qr.make(fit=True)

    img = qr.make_image(fill_color="#0a0e1a", back_color="white")

    filename = f"passport_{patient_id}_{passport_hash[:8]}.png"
    filepath = QR_DIR / filename
    img.save(str(filepath))

    log.info(f"QR code generated: {filepath}")
    return str(filepath)


def qr_to_base64(filepath: str) -> str:
    """Return base64-encoded PNG for inline embedding in API responses."""
    with open(filepath, "rb") as f:
        return base64.b64encode(f.read()).decode()
