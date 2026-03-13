from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    course = Column(String, nullable=True)
    semester = Column(String, nullable=True)
    subjects = Column(Text, nullable=True)  # JSON string list
    exam_date = Column(String, nullable=True)
    subject_exam_dates = Column(Text, nullable=True)  # JSON object: {subject: yyyy-mm-dd}
    created_at = Column(DateTime, default=datetime.utcnow)

    sessions = relationship("StudySession", back_populates="user")


class StudySession(Base):
    __tablename__ = "study_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    subject = Column(String, nullable=False)
    duration_minutes = Column(Float, nullable=False)
    time_of_day = Column(String, nullable=False)  # Morning / Afternoon / Night
    focus_level = Column(Integer, nullable=False)  # 1-5
    notes = Column(Text, nullable=True)
    date = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="sessions")
