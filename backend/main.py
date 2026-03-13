from fastapi import FastAPI, Depends, HTTPException, status
from pydantic import BaseModel as PydanticBaseModel
import httpx
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime, timedelta
from typing import List, Optional, Dict
import json
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from database import engine, get_db, Base
import models
import schemas
from auth import (
    hash_password, verify_password, create_access_token,
    get_current_user, ACCESS_TOKEN_EXPIRE_MINUTES
)
from ml_model import predict_readiness, get_grade_range, train_model
import os

# Create tables
Base.metadata.create_all(bind=engine)


def ensure_schema_updates():
    with engine.begin() as conn:
        user_columns = [row[1] for row in conn.execute(text("PRAGMA table_info(users)")).fetchall()]
        if "subject_exam_dates" not in user_columns:
            conn.execute(text("ALTER TABLE users ADD COLUMN subject_exam_dates TEXT"))


ensure_schema_updates()

# Pre-train model on startup
if not os.path.exists("study_model.pkl"):
    train_model()

app = FastAPI(title="Smart Study Habit Analyzer API", version="1.0.0")


def get_allowed_origins():
    origins_from_env = os.getenv("CORS_ORIGINS")
    if origins_from_env:
        return [origin.strip() for origin in origins_from_env.split(",") if origin.strip()]
    return [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://saikumarreddyappidi.github.io",
        "https://saikumarreddyappidi.github.io/smartstudy",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── AUTH ──────────────────────────────────────────────────────────────────────

@app.post("/signup", response_model=schemas.Token)
def signup(user_data: schemas.UserCreate, db: Session = Depends(get_db)):
    existing = db.query(models.User).filter(models.User.email == user_data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = models.User(
        name=user_data.name,
        email=user_data.email,
        hashed_password=hash_password(user_data.password),
        course=user_data.course,
        semester=user_data.semester,
        subjects=user_data.subjects,
        exam_date=user_data.exam_date,
        subject_exam_dates=user_data.subject_exam_dates,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token({"sub": str(user.id)})
    return schemas.Token(
        access_token=token,
        token_type="bearer",
        user=schemas.UserOut.model_validate(user)
    )


@app.post("/login", response_model=schemas.Token)
def login(credentials: schemas.UserLogin, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == credentials.email).first()
    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token({"sub": str(user.id)})
    return schemas.Token(
        access_token=token,
        token_type="bearer",
        user=schemas.UserOut.model_validate(user)
    )


@app.get("/me", response_model=schemas.UserOut)
def get_me(current_user: models.User = Depends(get_current_user)):
    return current_user


@app.put("/me", response_model=schemas.UserOut)
def update_me(
    update: schemas.UserUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    for field, value in update.model_dump(exclude_none=True).items():
        setattr(current_user, field, value)
    db.commit()
    db.refresh(current_user)
    return current_user


# ─── SESSIONS ─────────────────────────────────────────────────────────────────

@app.post("/log-session", response_model=schemas.StudySessionOut)
def log_session(
    session_data: schemas.StudySessionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    session = models.StudySession(
        user_id=current_user.id,
        subject=session_data.subject,
        duration_minutes=session_data.duration_minutes,
        time_of_day=session_data.time_of_day,
        focus_level=session_data.focus_level,
        notes=session_data.notes,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@app.get("/sessions/{user_id}", response_model=List[schemas.StudySessionOut])
def get_sessions(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    sessions = db.query(models.StudySession).filter(
        models.StudySession.user_id == user_id
    ).order_by(models.StudySession.date.desc()).all()
    return sessions


# ─── HEATMAP ──────────────────────────────────────────────────────────────────

@app.get("/heatmap/{user_id}")
def get_heatmap(
    user_id: int,
    days: int = 90,
    subject: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    since = datetime.utcnow() - timedelta(days=days)
    query = db.query(models.StudySession).filter(
        models.StudySession.user_id == user_id,
        models.StudySession.date >= since
    )
    if subject:
        query = query.filter(models.StudySession.subject == subject)

    sessions = query.all()

    heatmap = {}
    for s in sessions:
        day = s.date.strftime("%Y-%m-%d")
        heatmap[day] = heatmap.get(day, 0) + s.duration_minutes / 60

    result = [{"date": k, "hours": round(v, 2)} for k, v in sorted(heatmap.items())]
    return result


# ─── ANALYTICS ────────────────────────────────────────────────────────────────

@app.get("/analytics/{user_id}")
def get_analytics(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    now = datetime.utcnow()
    two_weeks_ago = now - timedelta(days=14)
    one_week_ago = now - timedelta(days=7)

    all_sessions = db.query(models.StudySession).filter(
        models.StudySession.user_id == user_id
    ).all()

    # Hours per subject (this week)
    week_sessions = [s for s in all_sessions if s.date >= one_week_ago]
    subject_hours = {}
    for s in week_sessions:
        subject_hours[s.subject] = subject_hours.get(s.subject, 0) + s.duration_minutes / 60
    subject_chart = [{"subject": k, "hours": round(v, 2)} for k, v in subject_hours.items()]

    # Daily trend (last 14 days)
    daily_map = {}
    for s in all_sessions:
        if s.date >= two_weeks_ago:
            day = s.date.strftime("%Y-%m-%d")
            daily_map[day] = daily_map.get(day, 0) + s.duration_minutes / 60
    daily_trend = [{"date": k, "hours": round(v, 2)} for k, v in sorted(daily_map.items())]

    # All-time subject distribution
    total_subject = {}
    for s in all_sessions:
        total_subject[s.subject] = total_subject.get(s.subject, 0) + s.duration_minutes / 60
    subject_pie = [{"subject": k, "hours": round(v, 2)} for k, v in total_subject.items()]

    # Productive vs Unproductive
    productive = 0
    unproductive = 0
    for s in all_sessions:
        if s.time_of_day == "Night" and s.focus_level < 3:
            unproductive += s.duration_minutes / 60
        else:
            productive += s.duration_minutes / 60

    # Today's summary
    today = now.date()
    today_mins = sum(
        s.duration_minutes for s in all_sessions
        if s.date.date() == today
    )

    # Productivity score (last 7 days)
    if week_sessions:
        avg_focus = sum(s.focus_level for s in week_sessions) / len(week_sessions)
        total_week_hours = sum(s.duration_minutes for s in week_sessions) / 60
        productivity_score = min(100, int((avg_focus / 5) * 50 + min(total_week_hours / 20, 1) * 50))
    else:
        productivity_score = 0

    return {
        "subject_hours_weekly": subject_chart,
        "daily_trend": daily_trend,
        "subject_distribution": subject_pie,
        "productive_hours": round(productive, 2),
        "unproductive_hours": round(unproductive, 2),
        "today_minutes": today_mins,
        "productivity_score": productivity_score,
        "total_hours": round(sum(s.duration_minutes for s in all_sessions) / 60, 2),
    }


# ─── PREDICTIONS ──────────────────────────────────────────────────────────────

@app.get("/predict/{user_id}")
def get_predictions(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    user = db.query(models.User).filter(models.User.id == user_id).first()
    subjects_raw = user.subjects or ""
    subjects = [s.strip() for s in subjects_raw.split(",") if s.strip()]
    if not subjects:
        subjects = ["General"]

    exam_date_str = user.exam_date
    days_until_exam = 30
    if exam_date_str:
        try:
            exam_dt = datetime.strptime(exam_date_str, "%Y-%m-%d")
            days_until_exam = max(1, (exam_dt - datetime.utcnow()).days)
        except Exception:
            pass

    subject_exam_dates_map = {}
    if user.subject_exam_dates:
        try:
            parsed = json.loads(user.subject_exam_dates)
            if isinstance(parsed, dict):
                subject_exam_dates_map = parsed
        except Exception:
            subject_exam_dates_map = {}

    all_sessions = db.query(models.StudySession).filter(
        models.StudySession.user_id == user_id
    ).all()

    results = []
    for subj in subjects:
        subj_sessions = [s for s in all_sessions if s.subject.lower() == subj.lower()]
        total_hours = sum(s.duration_minutes for s in subj_sessions) / 60
        sessions_per_week = len(subj_sessions) / max(1, (datetime.utcnow() - (subj_sessions[-1].date if subj_sessions else datetime.utcnow())).days / 7) if subj_sessions else 0
        avg_focus = sum(s.focus_level for s in subj_sessions) / len(subj_sessions) if subj_sessions else 2.5

        subject_days_until_exam = days_until_exam
        subj_exam_date = subject_exam_dates_map.get(subj)
        if subj_exam_date:
            try:
                subject_exam_dt = datetime.strptime(subj_exam_date, "%Y-%m-%d")
                subject_days_until_exam = max(1, (subject_exam_dt - datetime.utcnow()).days)
            except Exception:
                subject_days_until_exam = days_until_exam

        readiness = predict_readiness(
            total_hours=total_hours,
            sessions_per_week=sessions_per_week,
            avg_focus_score=avg_focus,
            days_until_exam=subject_days_until_exam,
            subject_difficulty=3
        )
        results.append({
            "subject": subj,
            "readiness_score": readiness,
            "grade_range": get_grade_range(readiness),
            "risk_alert": readiness < 50,
            "total_hours": round(total_hours, 2),
            "avg_focus": round(avg_focus, 2),
            "days_until_exam": subject_days_until_exam,
        })

    return {"predictions": results, "days_until_exam": days_until_exam}


# ─── RECOMMENDATIONS ──────────────────────────────────────────────────────────

@app.get("/recommendations/{user_id}")
def get_recommendations(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    user = db.query(models.User).filter(models.User.id == user_id).first()
    subjects_raw = user.subjects or ""
    subjects = [s.strip() for s in subjects_raw.split(",") if s.strip()]

    all_sessions = db.query(models.StudySession).filter(
        models.StudySession.user_id == user_id
    ).all()

    # Best time of day
    time_counts = {}
    time_focus = {}
    for s in all_sessions:
        time_counts[s.time_of_day] = time_counts.get(s.time_of_day, 0) + 1
        if s.time_of_day not in time_focus:
            time_focus[s.time_of_day] = []
        time_focus[s.time_of_day].append(s.focus_level)

    best_time = "Morning"
    if time_focus:
        best_time = max(time_focus.keys(), key=lambda t: sum(time_focus[t]) / len(time_focus[t]))

    # Hours per subject
    subject_hours = {}
    for s in all_sessions:
        subject_hours[s.subject] = subject_hours.get(s.subject, 0) + s.duration_minutes / 60

    # Weak subjects (less than average hours)
    all_hours = list(subject_hours.values())
    avg_hours = sum(all_hours) / len(all_hours) if all_hours else 0
    weak_subjects = [k for k, v in subject_hours.items() if v < avg_hours]
    if not weak_subjects and subjects:
        weak_subjects = subjects[:2]

    # Generate schedule
    schedule = []
    for i, subj in enumerate(subjects[:5]):
        hours = 1.5 if subj in weak_subjects else 1.0
        time = best_time if i % 2 == 0 else ("Afternoon" if best_time != "Afternoon" else "Evening")
        schedule.append({
            "subject": subj,
            "suggested_hours": hours,
            "time_of_day": time,
            "priority": "High" if subj in weak_subjects else "Normal"
        })

    tips = []
    if best_time:
        tips.append(f"You study best in the {best_time}. Schedule your hardest topics during this time.")
    if weak_subjects:
        tips.append(f"Focus more on {', '.join(weak_subjects[:2])} — they need more attention.")

    night_sessions = [s for s in all_sessions if s.time_of_day == "Night" and s.focus_level < 3]
    if len(night_sessions) > 2:
        tips.append("Avoid late-night study sessions — your focus drops significantly after midnight.")

    avg_focus_all = sum(s.focus_level for s in all_sessions) / len(all_sessions) if all_sessions else 0
    if avg_focus_all < 3 and all_sessions:
        tips.append("Your average focus is low. Try Pomodoro technique: 25 min study + 5 min break.")

    if not tips:
        tips.append("Keep up the great work! Consistency is the key to exam success.")

    return {
        "best_study_time": best_time,
        "weak_subjects": weak_subjects,
        "suggested_schedule": schedule,
        "tips": tips,
        "subject_hours": [{"subject": k, "hours": round(v, 2)} for k, v in subject_hours.items()],
    }


# ─── AI CHATBOT ───────────────────────────────────────────────────────────────

@app.get("/chatbot/{user_id}")
def ai_chatbot(
    user_id: int,
    question: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    user = db.query(models.User).filter(models.User.id == user_id).first()
    all_sessions = db.query(models.StudySession).filter(
        models.StudySession.user_id == user_id
    ).all()

    subjects_raw = user.subjects or ""
    subjects = [s.strip() for s in subjects_raw.split(",") if s.strip()]
    primary_subject = subjects[0] if subjects else "your weakest subject"

    total_hours = round(sum(s.duration_minutes for s in all_sessions) / 60, 2)
    avg_focus = round((sum(s.focus_level for s in all_sessions) / len(all_sessions)), 2) if all_sessions else 0
    productive = sum(s.duration_minutes for s in all_sessions if not (s.time_of_day == "Night" and s.focus_level < 3)) / 60
    unproductive = sum(s.duration_minutes for s in all_sessions if (s.time_of_day == "Night" and s.focus_level < 3)) / 60
    productive_pct = int((productive / (productive + unproductive)) * 100) if (productive + unproductive) > 0 else 0

    exam_date_str = user.exam_date
    days_until_exam = None
    if exam_date_str:
        try:
            exam_dt = datetime.strptime(exam_date_str, "%Y-%m-%d")
            days_until_exam = max(0, (exam_dt - datetime.utcnow()).days)
        except Exception:
            days_until_exam = None

    suggested_questions = [
        "How can I improve my productivity score this week?",
        f"What should I study tomorrow for {primary_subject}?",
        "How to reduce unproductive night study sessions?",
        "Give me a quick exam readiness strategy",
        "What is my current study health summary?"
    ]

    default_answer = (
        "I can help with study plans, productivity, readiness strategy, and focus improvement. "
        "Ask any question or click a suggested question."
    )

    if not question or not question.strip():
        return {
            "answer": default_answer,
            "suggested_questions": suggested_questions
        }

    q = question.lower().strip()

    if "productivity" in q or "score" in q:
        answer = (
            f"Your productive study ratio is about {productive_pct}%. "
            "To increase your score quickly: keep 2 focused sessions/day, target focus >= 4, "
            "and move difficult topics to morning/afternoon."
        )
    elif "tomorrow" in q or "study" in q or "plan" in q:
        answer = (
            f"Tomorrow plan: Study {primary_subject} for 90 minutes in the morning, "
            "then 60 minutes revision in the evening. Use Pomodoro (25/5) and end with 10-minute recap notes."
        )
    elif "night" in q or "unproductive" in q:
        answer = (
            "Avoid heavy topics after 11 PM. Keep night sessions to light revision only, "
            "cap at 45 minutes, and stop if focus drops below 3."
        )
    elif "exam" in q or "readiness" in q:
        day_text = f"You have about {days_until_exam} days left. " if days_until_exam is not None else ""
        answer = (
            f"{day_text}Focus on high-weight chapters first, practice previous questions every 2 days, "
            "and keep one weekly mock test with error review."
        )
    elif "summary" in q or "health" in q:
        answer = (
            f"Current summary: total study {total_hours} hours, average focus {avg_focus}/5, "
            f"productive ratio {productive_pct}%. "
            "Maintain consistency and increase weak-subject hours by 20% this week."
        )
    else:
        answer = (
            "Great question. Based on your logs, keep sessions consistent, prioritize weak subjects, "
            "study hard topics when focus is highest, and review every day briefly to retain concepts better."
        )

    return {
        "answer": answer,
        "suggested_questions": suggested_questions
    }


# ─── GROQ PROXY ───────────────────────────────────────────────────────────────

_GROQ_KEY = os.getenv(
    "GROQ_API_KEY",
    ""
)
_GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")


class ClaudeRequest(PydanticBaseModel):
    system: str
    message: str
    max_tokens: int = 2000
    response_format: str | None = None


class QuizAttempt(PydanticBaseModel):
    topic: str = "Study Kit"
    score: int = 0
    total: int = 0
    accuracy: int = 0
    timestamp: Optional[str] = None


class LogoutEmailPayload(PydanticBaseModel):
    session_minutes: float = 0
    quiz_attempts: List[QuizAttempt] = []


def _days_until(date_text: Optional[str]) -> Optional[int]:
    if not date_text:
        return None
    try:
        d = datetime.strptime(date_text, "%Y-%m-%d").date()
        return (d - datetime.utcnow().date()).days
    except Exception:
        return None


def _build_subject_countdowns(user: models.User) -> List[Dict[str, str]]:
    subjects = [s.strip() for s in (user.subjects or "").split(",") if s.strip()]
    if not subjects:
        subjects = ["General"]

    subject_dates: Dict[str, str] = {}
    if user.subject_exam_dates:
        try:
            parsed = json.loads(user.subject_exam_dates)
            if isinstance(parsed, dict):
                subject_dates = {str(k).strip(): str(v).strip() for k, v in parsed.items()}
        except Exception:
            subject_dates = {}

    result = []
    for subject in subjects:
        exam_date = subject_dates.get(subject) or user.exam_date
        days_left = _days_until(exam_date)
        if days_left is None:
            countdown = "Date not set"
        elif days_left >= 0:
            countdown = f"{days_left} day(s) left"
        else:
            countdown = f"{abs(days_left)} day(s) overdue"
        result.append({
            "subject": subject,
            "exam_date": exam_date or "Not set",
            "countdown": countdown,
        })
    return result


def _send_logout_email(
    user: models.User,
    session_minutes: float,
    attempts: List[QuizAttempt],
    countdowns: List[Dict[str, str]],
):
    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER")
    smtp_password = os.getenv("SMTP_PASSWORD")
    smtp_from = os.getenv("SMTP_FROM", smtp_user or "")

    if not smtp_user or not smtp_password:
        return False, "Email service not configured. Set SMTP_USER and SMTP_PASSWORD."

    overall_days = _days_until(user.exam_date)
    if overall_days is None:
        overall_line = f"Overall Exam Date: {user.exam_date or 'Not set'}"
    elif overall_days >= 0:
        overall_line = f"Overall Exam Date: {user.exam_date} ({overall_days} day(s) left)"
    else:
        overall_line = f"Overall Exam Date: {user.exam_date} ({abs(overall_days)} day(s) overdue)"

    subject_lines = "\n".join(
        [f"- {r['subject']}: {r['exam_date']} | {r['countdown']}" for r in countdowns]
    )

    quiz_lines = "\n".join([
        f"- {a.topic}: {a.score}/{a.total} ({a.accuracy}%)"
        + (f" at {a.timestamp}" if a.timestamp else "")
        for a in attempts
    ]) if attempts else "- No quiz attempts recorded"

    body = (
        f"Hi {user.name},\n\n"
        "You have logged out of SmartStudy. Here is your session summary:\n\n"
        f"Time spent this visit: {round(session_minutes, 2)} minute(s)\n"
        f"{overall_line}\n\n"
        "Subject-wise exam countdown:\n"
        f"{subject_lines}\n\n"
        "Recent quiz attempts:\n"
        f"{quiz_lines}\n\n"
        "Keep going. Consistency wins.\n"
        "- SmartStudy"
    )

    msg = MIMEMultipart()
    msg["From"] = smtp_from
    msg["To"] = user.email
    msg["Subject"] = "SmartStudy Logout Summary"
    msg.attach(MIMEText(body, "plain"))

    with smtplib.SMTP(smtp_host, smtp_port, timeout=20) as server:
        server.starttls()
        server.login(smtp_user, smtp_password)
        server.sendmail(smtp_from, [user.email], msg.as_string())

    return True, "Email sent"


@app.post("/claude")
async def claude_proxy(payload: ClaudeRequest):
    url = "https://api.groq.com/openai/v1/chat/completions"
    system_text = payload.system
    if payload.response_format == "json":
        system_text += "\n\nReturn valid JSON only. Do not include markdown or code fences."

    body = {
        "model": _GROQ_MODEL,
        "messages": [
            {"role": "system", "content": system_text},
            {"role": "user", "content": payload.message},
        ],
        "max_tokens": payload.max_tokens,
        "temperature": 0.2,
    }
    if payload.response_format == "json":
        body["response_format"] = {"type": "json_object"}

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            url,
            headers={
                "Authorization": f"Bearer {_GROQ_KEY}",
                "Content-Type": "application/json",
            },
            json=body,
        )

    # Some Groq models may not support response_format; retry without it.
    if resp.status_code == 400 and payload.response_format == "json":
        body.pop("response_format", None)
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                url,
                headers={
                    "Authorization": f"Bearer {_GROQ_KEY}",
                    "Content-Type": "application/json",
                },
                json=body,
            )

    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code, detail=resp.text)

    data = resp.json()
    text_out = data.get("choices", [{}])[0].get("message", {}).get("content", "")
    if isinstance(text_out, list):
        # Some providers return segmented content arrays.
        text_out = "".join(part.get("text", "") for part in text_out if isinstance(part, dict))
    return {"text": text_out}


@app.post("/logout-email/{user_id}")
def send_logout_email(
    user_id: int,
    payload: LogoutEmailPayload,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    countdowns = _build_subject_countdowns(user)
    recent_attempts = sorted(
        payload.quiz_attempts,
        key=lambda a: a.timestamp or "",
        reverse=True,
    )[:10]

    try:
        sent, message = _send_logout_email(
            user=user,
            session_minutes=payload.session_minutes,
            attempts=recent_attempts,
            countdowns=countdowns,
        )
        return {"sent": sent, "message": message}
    except Exception as e:
        return {"sent": False, "message": f"Failed to send email: {str(e)}"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
