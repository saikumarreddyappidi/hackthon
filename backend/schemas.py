from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime


class UserCreate(BaseModel):
    name: str
    email: str
    password: str
    course: Optional[str] = None
    semester: Optional[str] = None
    subjects: Optional[str] = None  # comma-separated
    exam_date: Optional[str] = None
    subject_exam_dates: Optional[str] = None


class UserLogin(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    id: int
    name: str
    email: str
    course: Optional[str]
    semester: Optional[str]
    subjects: Optional[str]
    exam_date: Optional[str]
    subject_exam_dates: Optional[str]

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    name: Optional[str] = None
    course: Optional[str] = None
    semester: Optional[str] = None
    subjects: Optional[str] = None
    exam_date: Optional[str] = None
    subject_exam_dates: Optional[str] = None


class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserOut


class StudySessionCreate(BaseModel):
    subject: str
    duration_minutes: float
    time_of_day: str
    focus_level: int
    notes: Optional[str] = None


class StudySessionOut(BaseModel):
    id: int
    user_id: int
    subject: str
    duration_minutes: float
    time_of_day: str
    focus_level: int
    notes: Optional[str]
    date: datetime

    class Config:
        from_attributes = True
