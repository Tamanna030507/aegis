from datetime import datetime
from typing import Optional

from sqlalchemy import String, Float, Integer, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.database import Base


class CheckIn(Base):
    __tablename__ = "checkins"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    patient_id: Mapped[str] = mapped_column(String(36), ForeignKey("patients.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    day_post_op: Mapped[int] = mapped_column(Integer, nullable=False)

    # ── Vitals ────────────────────────────────────────────────────────────────
    temperature: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    spo2: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # ── Pain ──────────────────────────────────────────────────────────────────
    raw_pain_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    pcps: Mapped[Optional[float]] = mapped_column(Float, nullable=True)  # PK-corrected
    medication_drug: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    medication_hours_since_dose: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    pk_corrected: Mapped[bool] = mapped_column(Boolean, default=False)

    # ── Wound ─────────────────────────────────────────────────────────────────
    wound_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    wound_flags: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON list
    wound_analysis_available: Mapped[bool] = mapped_column(Boolean, default=False)

    # ── Voice ─────────────────────────────────────────────────────────────────
    voice_pain_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    voice_confidence: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # ── Keystroke ─────────────────────────────────────────────────────────────
    keystroke_pain_index: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    keystroke_iki_mean: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    keystroke_error_rate: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # ── Overall risk ──────────────────────────────────────────────────────────
    overall_risk_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    data_quality: Mapped[str] = mapped_column(String(20), default="normal")  # normal | degraded

    patient: Mapped["Patient"] = relationship("Patient", back_populates="checkins")  # noqa: F821
