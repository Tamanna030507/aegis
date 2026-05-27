"""
Demo Data Seeder — seeds Patient 0047 scenario.
Run once via: python -m scripts.seed_demo
Or auto-triggered by main.py on first startup.

Bug 5 fix: QR generation is idempotent — checks if QR already exists before creating a new one.
"""
import asyncio
import glob
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


async def seed_patient_0047(db=None):
    """Seed Patient 0047 with full Risk Fingerprint and 5 days of check-in history."""
    from backend.database import SessionLocal, init_db
    from backend.models.patient import Patient
    from backend.models.checkin import CheckIn
    from backend.models.risk import RiskScore

    close_db = False
    if db is None:
        init_db()
        db = SessionLocal()
        close_db = True

    try:
        # ── Patient record ───────────────────────────────────────────────────
        existing = db.query(Patient).filter(Patient.id == "0047").first()
        if existing:
            print("[seed] Patient 0047 already exists — skipping patient record.")
        else:
            patient = Patient(
                id="0047",
                name="Demo Patient [Anonymized]",
                procedure_type="Robotic laparoscopic colectomy",
                procedure_date="2026-06-01",
                robot_model="da_vinci_xi",
                attending_physician="Dr. A. Seitkali",
                tissue_resistance_index=1.14,
                suture_tension_score=2.3,
                blood_loss_class="minimal",
                anomaly_flags=json.dumps(["minor_retraction_event"]),
                healing_class="class_ii_moderate",
                risk_fingerprint_hash="a7f3c9e2d1b4f8a0c3e5d7f9b1a2c4e6f8a0b2c4d6e8f0a2b4c6d8e0f2a4c6d8",
                risk_fingerprint_generated=True,
            )
            db.add(patient)
            db.commit()
            print("[seed] Patient 0047 created.")

        # ── Check-in history (Days 1–5) ───────────────────────────────────────
        from backend.models.checkin import CheckIn
        existing_checkins = db.query(CheckIn).filter(CheckIn.patient_id == "0047").count()
        if existing_checkins > 0:
            print(f"[seed] {existing_checkins} check-ins already exist — skipping check-in history.")
        else:
            history = [
                dict(day=1, temp=37.1, pain=3.5, pcps=2.8, wound=88, ks=2.1, voice=2.5),
                dict(day=2, temp=37.4, pain=5.0, pcps=4.2, wound=81, ks=3.8, voice=3.9),
                dict(day=3, temp=37.7, pain=6.0, pcps=5.1, wound=74, ks=5.2, voice=5.0),
                dict(day=4, temp=37.8, pain=6.5, pcps=5.9, wound=67, ks=5.9, voice=5.8),
                dict(day=5, temp=37.9, pain=7.2, pcps=6.8, wound=61, ks=6.2, voice=6.5),
            ]
            for h in history:
                checkin = CheckIn(
                    patient_id="0047",
                    day_post_op=h["day"],
                    temperature=h["temp"],
                    raw_pain_score=h["pain"],
                    pcps=h["pcps"],
                    pk_corrected=True,
                    medication_drug="tramadol",
                    medication_hours_since_dose=4.5,
                    wound_score=h["wound"],
                    wound_analysis_available=True,
                    voice_pain_score=h["voice"],
                    voice_confidence=0.85,
                    keystroke_pain_index=h["ks"],
                    overall_risk_score=round(
                        (100 - h["wound"]) / 100 * 0.4 +
                        h["pcps"] / 10 * 0.35 +
                        (h["temp"] - 37) / 2 * 0.1 +
                        0.14 * 0.15, 3
                    ),
                    data_quality="good",
                )
                db.add(checkin)
            db.commit()
            print("[seed] Check-in history (Days 1–5) seeded.")

        # ── Risk score + Cascade DAG ───────────────────────────────────────────
        existing_risk = db.query(RiskScore).filter(RiskScore.patient_id == "0047").count()
        if existing_risk > 0:
            print(f"[seed] {existing_risk} risk scores already exist — skipping.")
        else:
            # Build rule-based cascade from patient data (no hardcoded PATIENT_0047_CASCADE)
            from backend.agents.cascade_agent import _build_rule_based_cascade
            risk_vector = {
                "tissue_resistance_index": 1.14,
                "wound_score": 61,
                "wound_score_delta": -7.0,
                "pcps": 6.8,
                "keystroke_pain_index": 6.2,
                "temperature": 37.9,
                "temp_trend": 0.1,
                "healing_class": "class_ii_moderate",
                "anomaly_flags": ["minor_retraction_event"],
                "overall_risk": 0.72,
                "wound_analysis_available": True,
                "procedure_complexity": 1,
            }
            cascade = _build_rule_based_cascade(risk_vector, day_post_op=5)
            cascade_json = json.dumps(cascade.model_dump())

            risk = RiskScore(
                patient_id="0047",
                day_post_op=5,
                overall_risk=0.72,
                risk_level="high",
                wound_component=0.39,
                pain_component=0.62,
                cascade_dag_json=cascade_json,
                escalation_triggered=False,
            )
            db.add(risk)
            db.commit()
            print("[seed] Risk score + Cascade DAG seeded.")

        # ── Bug 5 fix: QR — idempotent, keep only ONE file ───────────────────
        qr_dir = Path("static/qr")
        qr_dir.mkdir(parents=True, exist_ok=True)
        existing_qrs = sorted(glob.glob(str(qr_dir / "passport_0047_*.png")))

        if existing_qrs:
            # Keep only the most recent QR; delete all others
            latest = existing_qrs[-1]
            to_delete = existing_qrs[:-1]
            for f in to_delete:
                os.remove(f)
                print(f"[seed] Deleted duplicate QR: {f}")
            print(f"[seed] ✓ Passport QR already exists: {latest} — kept (deleted {len(to_delete)} duplicates)")
        else:
            # Generate exactly one QR
            try:
                from backend.services.passport import build_payload, sign_passport
                from backend.services.risk_fingerprint import RiskFingerprint
                from backend.utils.qr_generator import generate_passport_qr
                import base64

                fp = RiskFingerprint(
                    tissue_resistance_index=1.14,
                    suture_tension_score=2.3,
                    blood_loss_class="minimal",
                    anomaly_flags=["minor_retraction_event"],
                    healing_class="class_ii_moderate",
                    procedure_risk_multiplier=1.0,
                    data_quality="good",
                    fingerprint_hash="a7f3c9e2d1b4f8a0c3e5d7f9b1a2c4e6f8a0b2c4d6e8f0a2b4c6d8e0f2a4c6d8",
                )
                payload = build_payload("0047", {
                    "procedure_type": "Robotic laparoscopic colectomy",
                    "procedure_date": "2026-06-01",
                    "robot_model": "da_vinci_xi",
                }, fp)
                signed = sign_passport(payload)
                passport_b64 = base64.b64encode(
                    json.dumps({"payload": signed.payload_json, "sig": signed.signature_b64}).encode()
                ).decode()
                qr_path = generate_passport_qr(signed.fingerprint_hash, passport_b64, "0047")
                print(f"[seed] ✓ Passport QR generated: {qr_path}")
            except Exception as e:
                print(f"[seed] QR generation skipped (non-fatal): {e}")

        print("[seed] DONE. Patient 0047 fully seeded. Demo ready.")

    except Exception as e:
        print(f"[seed] ERROR: {e}")
        db.rollback()
        raise
    finally:
        if close_db:
            db.close()


if __name__ == "__main__":
    asyncio.run(seed_patient_0047())
