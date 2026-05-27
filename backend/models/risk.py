from datetime import datetime
from typing import Optional

from sqlalchemy import String, Float, Integer, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.database import Base


class RiskScore(Base):
    __tablename__ = "risk_scores"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    patient_id: Mapped[str] = mapped_column(String(36), ForeignKey("patients.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    day_post_op: Mapped[int] = mapped_column(Integer, nullable=False)

    # ── Composite risk ────────────────────────────────────────────────────────
    overall_risk: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    risk_level: Mapped[str] = mapped_column(String(10), nullable=False, default="low")  # low|medium|high|critical

    # ── Component scores ──────────────────────────────────────────────────────
    wound_component: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    pain_component: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    keystroke_component: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    vitals_component: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # ── Cascade ───────────────────────────────────────────────────────────────
    cascade_dag_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # full DAG JSON
    escalation_triggered: Mapped[bool] = mapped_column(Boolean, default=False)
    evidence_brief: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    patient: Mapped["Patient"] = relationship("Patient", back_populates="risk_scores")  # noqa: F821
