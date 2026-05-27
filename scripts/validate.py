from backend.config import ESCALATION_RISK_THRESHOLD, CORS_ORIGINS, GEMINI_MODEL
from backend.models.patient import Patient
from backend.models.checkin import CheckIn
from backend.models.risk import RiskScore
from backend.models.passport import PassportRecord
from backend.services.risk_fingerprint import generate_fingerprint
from backend.services.pk_correction import compute_pcps
from backend.services.federated import get_network_status
from ml.cascade_model.train import predict
import pickle
from pathlib import Path

print("=== AEGIS System Validation ===")

# Test PK correction
pcps, corrected = compute_pcps(7.0, 'tramadol', 4.5)
print(f"PCPS: raw=7.0 -> corrected={pcps:.2f} pk_applied={corrected}")

# Test Risk Fingerprint
fp = generate_fingerprint({
    "tissue_resistance_index": 1.14, "suture_tension_score": 2.3,
    "blood_loss_ml": 180, "procedure_duration_min": 142,
    "anomaly_flags": ["minor_retraction_event"],
})
print(f"Risk Fingerprint: healing={fp.healing_class} TRI={fp.tissue_resistance_index}")

# Test cascade model
with open(Path('ml/cascade_model/model.pkl'), 'rb') as f:
    model = pickle.load(f)
result = predict(model, {
    'tissue_resistance_index': 1.14, 'wound_score_delta': -7,
    'pcps': 6.8, 'days_post_op': 5, 'procedure_complexity': 1, 'temp_trend': 0.4
})
print(f"Cascade model SSI risk: {result['surgical_site_infection']:.1%}")

# Test federated
status = get_network_status()
node_count = len(status['nodes'])
bytes_xfr = status['bytes_patient_data_transferred']
print(f"Federated: {node_count} nodes | {bytes_xfr} bytes patient data transferred")

print("")
print("All systems operational!")
print(f"CORS origins: {CORS_ORIGINS}")
print(f"Escalation threshold: {ESCALATION_RISK_THRESHOLD}")
