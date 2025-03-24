from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models import Subject
from app.schemas import SubjectResponse
from app.auth import get_current_user

router = APIRouter(tags=["subjects"])

@router.get("/", response_model=List[SubjectResponse])
def get_subjects(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Получить список всех активных разделов математики"""
    subjects = db.query(Subject).filter(Subject.is_active == True).offset(skip).limit(limit).all()
    return subjects

@router.get("/{subject_id}", response_model=SubjectResponse)
def get_subject(
    subject_id: int,
    db: Session = Depends(get_db)
):
    """Получить информацию о разделе по ID"""
    subject = db.query(Subject).filter(Subject.id == subject_id, Subject.is_active == True).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Раздел не найден")
    return subject