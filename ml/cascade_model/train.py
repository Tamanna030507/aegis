"""
Cascade Model Training Script.
Generates synthetic complication progression data and trains a GBM classifier.
Saves to ml/cascade_model/model.pkl — commit this file before the hackathon build starts.

Usage: python -m ml.cascade_model.train
"""
import os
import pickle
import numpy as np
from pathlib import Path
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.multioutput import MultiOutputClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report

MODEL_DIR = Path(__file__).parent
MODEL_PATH = MODEL_DIR / "model.pkl"


def generate_synthetic_data(n_samples: int = 2000):
    """
    Generate synthetic patient risk data with complication labels.
    Features: tissue_resistance_index, wound_score_delta, pain_pcps, days_post_op,
              procedure_complexity, temperature_trend
    Labels: 7 binary complication flags
    """
    np.random.seed(42)

    tri           = np.random.normal(1.0, 0.2, n_samples).clip(0.5, 2.0)
    wound_delta   = np.random.normal(-5, 8, n_samples).clip(-40, 5)
    pain_pcps     = np.random.normal(4.5, 2.0, n_samples).clip(0, 10)
    days_post_op  = np.random.randint(1, 15, n_samples).astype(float)
    procedure_cx  = np.random.choice([0, 1, 2], n_samples, p=[0.5, 0.35, 0.15])
    temp_trend    = np.random.normal(0.2, 0.5, n_samples).clip(-1, 2)

    X = np.column_stack([tri, wound_delta, pain_pcps, days_post_op, procedure_cx, temp_trend])

    # Labels: 7 complication types
    risk_score = (
        (tri - 1.0) * 0.3 +
        (-wound_delta / 40) * 0.3 +
        (pain_pcps / 10) * 0.25 +
        (temp_trend / 2) * 0.1 +
        (procedure_cx / 2) * 0.05
    ).clip(0, 1)

    # Use percentile-based thresholds to guarantee both classes in every label
    y = np.column_stack([
        (risk_score > np.percentile(risk_score, 40)).astype(int),
        (risk_score > np.percentile(risk_score, 55)).astype(int),
        (risk_score > np.percentile(risk_score, 50)).astype(int),
        (risk_score > np.percentile(risk_score, 65)).astype(int),
        (risk_score > np.percentile(risk_score, 45)).astype(int),
        (risk_score > np.percentile(risk_score, 70)).astype(int),
        (risk_score > np.percentile(risk_score, 60)).astype(int),
    ])

    return X, y


def train():
    print("[cascade] Generating synthetic training data...")
    X, y = generate_synthetic_data(n_samples=3000)

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    print("[cascade] Training GBM cascade model...")
    base_clf = GradientBoostingClassifier(n_estimators=80, max_depth=4, learning_rate=0.1, random_state=42)
    model = MultiOutputClassifier(base_clf, n_jobs=1)
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    print("[cascade] Validation complete.")
    print(f"[cascade] Sample accuracy per complication: {(y_pred == y_test).mean(axis=0).round(3)}")

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    with open(MODEL_PATH, "wb") as f:
        pickle.dump(model, f)
    print(f"[cascade] Model saved to {MODEL_PATH}")
    return model


def predict(model, features: dict) -> dict:
    """
    Run cascade prediction from a patient risk vector.
    Returns probability estimates for each complication type.
    """
    COMPLICATION_NAMES = [
        "elevated_wound_tension",
        "lymphatic_disruption",
        "seroma_formation",
        "surgical_site_infection",
        "delayed_healing",
        "anastomosis_leak",
        "hematoma",
    ]

    x = np.array([[
        features.get("tissue_resistance_index", 1.0),
        features.get("wound_score_delta", 0.0),
        features.get("pcps", 5.0),
        features.get("days_post_op", 5.0),
        features.get("procedure_complexity", 1),
        features.get("temp_trend", 0.0),
    ]])

    probs = []
    for est in model.estimators_:
        p = est.predict_proba(x)[0]
        probs.append(p[1] if len(p) > 1 else p[0])

    return {name: round(float(prob), 3) for name, prob in zip(COMPLICATION_NAMES, probs)}


if __name__ == "__main__":
    train()
