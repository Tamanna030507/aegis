from datetime import datetime
from typing import Optional

from sqlalchemy import String, Float, Integer, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.database import Base


class PassportRecord(Base):
    __tablename__ = "passports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    patient_id: Mapped[str] = mapped_column(String(36), ForeignKey("patients.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    payload_json: Mapped[str] = mapped_column(Text, nullable=False)      # raw JSON payload
    signature_b64: Mapped[str] = mapped_column(Text, nullable=False)     # ECDSA signature base64
    fingerprint_hash: Mapped[str] = mapped_column(String(64), nullable=False)  # SHA-256 of payload
    qr_image_path: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)  # saved PNG path
    signed_by: Mapped[str] = mapped_column(String(50), nullable=False)
    is_valid: Mapped[bool] = mapped_column(Boolean, default=True)

    patient: Mapped["Patient"] = relationship("Patient", back_populates="passports")  # noqa: F821
