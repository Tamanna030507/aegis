"""
OR Telemetry JSON Schema Documentation.
All fields used by AEGIS risk_fingerprint.py to generate the Surgical Risk Fingerprint.
"""

# Schema Reference
schema = {
    "patient_id": "string — anonymized UUID",
    "procedure_type": "string — e.g. robotic_laparoscopic_colectomy",
    "procedure_date": "string — ISO date YYYY-MM-DD",
    "robot_model": "string — e.g. da_vinci_xi | medtronic_hugo | cmr_versius",
    "operator_id": "string — surgeon identifier (anonymized)",

    # ── Intraoperative measurements ──────────────────────────────────────────
    "tissue_resistance_index": "float — ratio vs population mean (1.0 = average)",
    "suture_tension_score": "float — N/cm² at anastomosis",
    "blood_loss_ml": "float — estimated intraoperative blood loss (mL)",
    "procedure_duration_min": "float — total OR time (minutes)",
    "irrigation_events": "int — number of irrigation cycles",
    "retraction_events": "int — number of tissue retraction incidents",

    # ── Quality scores ────────────────────────────────────────────────────────
    "anastomosis_integrity_score": "float — 0–1 (1.0 = perfect seal)",
    "bowel_handling_score": "float — 0–1 (tissue trauma proxy)",
    "co2_pressure_mean_mmhg": "float — mean pneumoperitoneum pressure",

    # ── Temperature ───────────────────────────────────────────────────────────
    "intraop_temp_min": "float — minimum patient temp during surgery (°C)",
    "intraop_temp_max": "float — maximum patient temp during surgery (°C)",

    # ── Derived fields (computed by AEGIS) ────────────────────────────────────
    "anomaly_flags": "list[string] — e.g. ['minor_retraction_event', 'elevated_pressure']",
    "blood_loss_class": "string — minimal | moderate | major",
    "healing_prediction": "string — class_i_primary | class_ii_moderate | class_iii_complex",
}
