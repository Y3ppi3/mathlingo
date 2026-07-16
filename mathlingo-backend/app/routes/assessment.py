# app/routes/assessment.py
"""
Фаза 6: студенческие эндпоинты диагностического квиза до/после игр.

  GET  /api/games/assessment/status        сдан ли pre/post (для подсказок в хабе)
  GET  /api/games/assessment/{quiz_type}   вопросы без правильных ответов
  POST /api/games/assessment/{quiz_type}   отправка ответов -> балл + сохранение

Скоринг и правильные ответы — только на сервере (app/services/assessment.py).
POST защищён CSRF-middleware (не /admin, есть auth-cookie) — фронт шлёт через
общий api-axios-инстанс. Ретест не блокируем: аналитика берёт последнюю
попытку каждого типа, а повторный заход — валидный сценарий (перепрошёл игру).
"""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import AssessmentResult, User
from app.schemas import (
    AssessmentQuizResponse, AssessmentResultResponse,
    AssessmentStatusResponse, AssessmentSubmitRequest,
)
from app.services import assessment

router = APIRouter(prefix="/api/games/assessment", tags=["assessment"])


def _taken(db: Session, user_id: int, quiz_type: str) -> bool:
    return (
        db.query(AssessmentResult)
        .filter(AssessmentResult.user_id == user_id, AssessmentResult.quiz_type == quiz_type)
        .first()
        is not None
    )


@router.get("/status", response_model=AssessmentStatusResponse)
def get_status(
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user),
):
    return AssessmentStatusResponse(
        pre_taken=_taken(db, current_user.id, "pre"),
        post_taken=_taken(db, current_user.id, "post"),
        max_score=assessment.MAX_SCORE,
    )


@router.get("/{quiz_type}", response_model=AssessmentQuizResponse)
def get_quiz(
        quiz_type: str,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user),
):
    if quiz_type not in AssessmentResult.QUIZ_TYPES:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Неизвестный тип теста")
    return AssessmentQuizResponse(
        quiz_type=quiz_type,
        max_score=assessment.MAX_SCORE,
        already_taken=_taken(db, current_user.id, quiz_type),
        questions=assessment.public_questions(),
    )


@router.post("/{quiz_type}", response_model=AssessmentResultResponse)
def submit_quiz(
        quiz_type: str,
        body: AssessmentSubmitRequest,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user),
):
    if quiz_type not in AssessmentResult.QUIZ_TYPES:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Неизвестный тип теста")

    score = assessment.score_answers(body.answers)
    primary_game = assessment.compute_primary_game(db, current_user.id)
    row = AssessmentResult(
        user_id=current_user.id,
        quiz_type=quiz_type,
        primary_game=primary_game,
        score=score,
        answers=body.answers,
        taken_at=datetime.utcnow(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return AssessmentResultResponse(
        quiz_type=quiz_type,
        score=score,
        max_score=assessment.MAX_SCORE,
        primary_game=primary_game,
        taken_at=row.taken_at,
    )
