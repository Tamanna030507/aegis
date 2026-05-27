from datetime import datetime
from typing import Optional, List

from sqlalchemy import String, Float, Integer, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.database import Base


class Patient(Base):
    __tablename__ = "patients"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)  # UUID
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    date_of_birth: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    procedure_type: Mapped[str] = mapped_column(String(100), nullable=False)
    procedure_date: Mapped[str] = mapped_column(String(10), nullable=False)
    robot_model: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    attending_physician: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # ── Risk Fingerprint columns ──────────────────────────────────────────────
    tissue_resistance_index: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    suture_tension_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    blood_loss_class: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    anomaly_flags: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON list
    healing_class: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    risk_fingerprint_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    risk_fingerprint_generated: Mapped[bool] = mapped_column(Boolean, default=False)

    # Relationships
    checkins: Mapped[List["CheckIn"]] = relationship("CheckIn", back_populates="patient")  # noqa: F821
    risk_scores: Mapped[List["RiskScore"]] = relationship("RiskScore", back_populates="patient")  # noqa: F821
    passports: Mapped[List["PassportRecord"]] = relationship("PassportRecord", back_populates="patient")  # noqa: F821
