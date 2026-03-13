import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import LabelEncoder
import pickle
import os

MODEL_PATH = "study_model.pkl"


def generate_synthetic_data(n=2000):
    np.random.seed(42)
    data = []
    for _ in range(n):
        total_hours = np.random.uniform(1, 120)
        sessions_per_week = np.random.randint(1, 15)
        avg_focus_score = np.random.uniform(1, 5)
        days_until_exam = np.random.randint(1, 90)
        subject_difficulty = np.random.randint(1, 5)  # 1=easy, 5=very hard

        # Readiness scoring formula
        time_factor = min(total_hours / 80, 1.0) * 40
        frequency_factor = min(sessions_per_week / 10, 1.0) * 20
        focus_factor = (avg_focus_score / 5) * 20
        urgency_factor = max(0, (1 - days_until_exam / 90)) * 10
        difficulty_penalty = (subject_difficulty / 5) * 10
        noise = np.random.normal(0, 5)

        readiness = time_factor + frequency_factor + focus_factor + urgency_factor - difficulty_penalty + noise
        readiness = np.clip(readiness, 0, 100)

        data.append([total_hours, sessions_per_week, avg_focus_score, days_until_exam, subject_difficulty, readiness])

    df = pd.DataFrame(data, columns=[
        "total_hours", "sessions_per_week", "avg_focus_score",
        "days_until_exam", "subject_difficulty", "readiness_score"
    ])
    return df


def train_model():
    df = generate_synthetic_data()
    X = df[["total_hours", "sessions_per_week", "avg_focus_score", "days_until_exam", "subject_difficulty"]]
    y = df["readiness_score"]

    model = RandomForestRegressor(n_estimators=100, random_state=42, n_jobs=-1)
    model.fit(X, y)

    with open(MODEL_PATH, "wb") as f:
        pickle.dump(model, f)

    print("[ML] Model trained and saved.")
    return model


def load_model():
    if os.path.exists(MODEL_PATH):
        with open(MODEL_PATH, "rb") as f:
            return pickle.load(f)
    return train_model()


def predict_readiness(total_hours, sessions_per_week, avg_focus_score, days_until_exam, subject_difficulty=3):
    model = load_model()
    features = np.array([[total_hours, sessions_per_week, avg_focus_score, days_until_exam, subject_difficulty]])
    score = model.predict(features)[0]
    score = float(np.clip(score, 0, 100))
    return round(score, 1)


def get_grade_range(readiness_score: float) -> str:
    if readiness_score >= 85:
        return "90-100%"
    elif readiness_score >= 75:
        return "80-90%"
    elif readiness_score >= 65:
        return "70-80%"
    elif readiness_score >= 55:
        return "60-70%"
    elif readiness_score >= 45:
        return "50-60%"
    elif readiness_score >= 35:
        return "40-50%"
    else:
        return "Below 40%"
