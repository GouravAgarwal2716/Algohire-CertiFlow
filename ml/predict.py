"""
Pragati Skills Mission — Cohort Fraud Scoring CLI
Runs inference using our custom-trained Random Forest Ensemble without C-extension dependencies.
"""

import sys
import json
import os

FEATURE_NAMES = [
    "candidate_count",
    "mean_score",
    "std_dev",
    "pass_rate",
    "sequential_phone_ratio",
    "submission_hour",
    "centre_historic_pass_ratio",
    "score_skewness",
]

def predict_node(node: dict, x: list) -> float:
    if "value" in node:
        return node["value"]
    feat_idx = node["feature"]
    thresh = node["threshold"]
    if x[feat_idx] <= thresh:
        return predict_node(node["left"], x)
    return predict_node(node["right"], x)

def load_model(model_path="ml/models/forensic_anomaly_detector.json"):
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Model not found at {model_path}. Run train_model.py first.")
    with open(model_path, "r") as f:
        return json.load(f)

def score_cohort(cohort_features: dict, model=None) -> dict:
    if model is None:
        model = load_model()

    vector = [cohort_features.get(f, 0.0) for f in FEATURE_NAMES]
    trees = model["rf_trees"]
    predictions = [predict_node(t, vector) for t in trees]
    fraud_prob = sum(predictions) / len(predictions)

    # Risk level classification
    if fraud_prob >= 0.65:
        risk_level = "HIGH"
        prescribed_action = "ESCALATE_TO_STATE_VIGILANCE"
    elif fraud_prob >= 0.30:
        risk_level = "MEDIUM"
        prescribed_action = "MANUAL_REVIEW_RECOMMENDED"
    else:
        risk_level = "LOW"
        prescribed_action = "FAST_TRACK_APPROVAL"

    # Identify contributing risk factors
    flags = []
    if cohort_features.get("sequential_phone_ratio", 0) > 0.20:
        flags.append({
            "code": "SEQUENTIAL_PHONE_NUMBERS",
            "severity": "CRITICAL",
            "message": f"{cohort_features['sequential_phone_ratio']*100:.1f}% candidates share sequential SIM card numbers (ghost trainee signal)."
        })
    if cohort_features.get("std_dev", 10.0) < 4.0:
        flags.append({
            "code": "ABNORMAL_VARIANCE_COLLAPSE",
            "severity": "WARNING",
            "message": f"Grade standard deviation (±{cohort_features['std_dev']:.2f}) indicates artificial grade clamping."
        })
    if cohort_features.get("submission_hour", 12) in [0, 1, 2, 3, 4, 23]:
        flags.append({
            "code": "OFF_HOURS_BATCH_DUMP",
            "severity": "INFO",
            "message": f"Batch submitted at {cohort_features['submission_hour']:02d}:00 outside standard training hours."
        })

    return {
        "risk_score": round(fraud_prob * 100, 1),
        "risk_level": risk_level,
        "prescribed_action": prescribed_action,
        "active_flags": flags,
    }

if __name__ == "__main__":
    # Test on a suspicious ghost-candidate cohort
    suspicious_cohort = {
        "candidate_count": 50,
        "mean_score": 88.5,
        "std_dev": 2.8,
        "pass_rate": 1.0,
        "sequential_phone_ratio": 0.80,
        "submission_hour": 2,
        "centre_historic_pass_ratio": 0.65,
        "score_skewness": -1.4,
    }

    print("Running Custom Model Inference on Suspicious Cohort...")
    res = score_cohort(suspicious_cohort)
    print(json.dumps(res, indent=2))
