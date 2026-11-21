"""
Pragati Skills Mission — Synthetic Dataset Generator for Cohort Fraud Detection
Generates labeled cohorts simulating realistic vocational training data:
- Genuine cohorts (normal score distribution, natural mobile operator entropy, working-hour submissions)
- Collusive fraud cohorts (sequential SIM cards, artificial pass clusters, late-night dumps, ghost candidates)
"""

import json
import math
import random
import os

def generate_cohort(cohort_id: int, is_fraud: bool) -> dict:
    if not is_fraud:
        # Genuine cohort characteristics
        candidate_count = random.randint(15, 60)
        mean_score = random.uniform(62.0, 84.0)
        std_dev = random.uniform(8.0, 16.0)
        pass_rate = min(1.0, max(0.55, random.gauss(0.82, 0.08)))
        # Low sequential phone probability (< 5% accidental overlap)
        sequential_phone_ratio = random.uniform(0.0, 0.05)
        # Submission happens mostly during office hours (09:00 - 18:00)
        submission_hour = random.choices(
            population=list(range(24)),
            weights=[1, 1, 1, 1, 1, 1, 2, 4, 10, 15, 18, 16, 14, 15, 16, 17, 12, 8, 4, 2, 1, 1, 1, 1],
            k=1
        )[0]
        centre_historic_pass_ratio = random.uniform(0.70, 0.90)
        score_skewness = random.uniform(-0.6, 0.6)
        label = 0  # Genuine
    else:
        # Fraudulent / Collusive cohort characteristics
        fraud_type = random.choice(['GHOST_CANDIDATES', 'GRADE_INFLATION', 'MIDNIGHT_DUMP'])
        candidate_count = random.randint(25, 60)
        
        if fraud_type == 'GHOST_CANDIDATES':
            # SIM batch purchasing results in sequential phone numbers
            sequential_phone_ratio = random.uniform(0.60, 0.95)
            mean_score = random.uniform(78.0, 92.0)
            std_dev = random.uniform(2.0, 5.0)  # Unnaturally tight variance
            pass_rate = 1.0  # 100% pass
            submission_hour = random.randint(0, 23)
            score_skewness = random.uniform(-1.5, -0.8)
        elif fraud_type == 'GRADE_INFLATION':
            sequential_phone_ratio = random.uniform(0.10, 0.30)
            mean_score = random.uniform(88.0, 98.0)
            std_dev = random.uniform(1.5, 4.0)
            pass_rate = 1.0
            submission_hour = random.randint(8, 20)
            score_skewness = random.uniform(-2.0, -1.0)
        else: # MIDNIGHT_DUMP
            sequential_phone_ratio = random.uniform(0.40, 0.80)
            mean_score = random.uniform(80.0, 90.0)
            std_dev = random.uniform(3.0, 7.0)
            pass_rate = random.uniform(0.95, 1.0)
            submission_hour = random.choice([0, 1, 2, 3, 4, 23])  # Deep night
            score_skewness = random.uniform(-1.2, -0.4)
            
        centre_historic_pass_ratio = random.uniform(0.50, 0.70)
        label = 1  # Fraud

    return {
        "cohort_id": f"COHORT-{cohort_id:05d}",
        "candidate_count": candidate_count,
        "mean_score": round(mean_score, 2),
        "std_dev": round(std_dev, 2),
        "pass_rate": round(pass_rate, 4),
        "sequential_phone_ratio": round(sequential_phone_ratio, 4),
        "submission_hour": submission_hour,
        "centre_historic_pass_ratio": round(centre_historic_pass_ratio, 4),
        "score_skewness": round(score_skewness, 4),
        "is_fraud": label,
    }

def generate_dataset(num_samples: int = 10000, fraud_ratio: float = 0.15):
    random.seed(42)
    dataset = []
    num_fraud = int(num_samples * fraud_ratio)
    num_genuine = num_samples - num_fraud

    for i in range(num_genuine):
        dataset.append(generate_cohort(i + 1, is_fraud=False))

    for i in range(num_fraud):
        dataset.append(generate_cohort(num_genuine + i + 1, is_fraud=True))

    random.shuffle(dataset)
    
    os.makedirs("ml/data", exist_ok=True)
    output_path = "ml/data/cohort_fraud_dataset.json"
    with open(output_path, "w") as f:
        json.dump(dataset, f, indent=2)

    print(f"Dataset generated: {len(dataset)} cohorts saved to {output_path}")
    print(f"Genuine cohorts: {num_genuine} | Fraudulent cohorts: {num_fraud}")
    return dataset

if __name__ == "__main__":
    generate_dataset()
