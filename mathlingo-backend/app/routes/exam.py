# app/routes/exam.py
"""
Ф1 контент-бэкбона: выдача банка ЕГЭ/ОГЭ студенту. Быстрая динамическая
подгрузка — пагинация (limit/offset) + фильтры по составному индексу
(exam/track/task_number) + тема. Ответ и разбор НЕ отдаются в выдаче условий —
только в /attempt, после того как студент ответил.

Ф3 добавила тренажёр: /next (что решать дальше), /attempt (проверка + разбор),
/progress (прогресс курса по номерам заданий).
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import ExamTask, User
from app.schemas import (
    ExamAttemptRequest, ExamAttemptResult, ExamProgress,
    ExamTaskList, ExamTaskPublic, ExamTopicFacet,
)
from app.services import exam_trainer

router = APIRouter(prefix="/api/exam", tags=["exam"])


def _apply_filters(query, exam, track, topic, task_number):
    if exam is not None:
        query = query.filter(ExamTask.exam == exam)
    if track is not None:
        query = query.filter(ExamTask.track == track)
    if topic is not None:
        query = query.filter(ExamTask.topic == topic)
    if task_number is not None:
        query = query.filter(ExamTask.task_number == task_number)
    return query


@router.get("/tasks", response_model=ExamTaskList)
def list_exam_tasks(
        exam: Optional[str] = Query(default=None),
        track: Optional[str] = Query(default=None),
        topic: Optional[str] = Query(default=None),
        task_number: Optional[int] = Query(default=None),
        limit: int = Query(default=20, ge=1, le=100),
        offset: int = Query(default=0, ge=0),
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user),
):
    base = _apply_filters(db.query(ExamTask), exam, track, topic, task_number)
    total = base.order_by(None).count()
    items = base.order_by(ExamTask.task_number, ExamTask.id).offset(offset).limit(limit).all()
    return ExamTaskList(items=items, total=total, limit=limit, offset=offset)


@router.get("/topics", response_model=list[ExamTopicFacet])
def list_topics(
        exam: Optional[str] = Query(default=None),
        track: Optional[str] = Query(default=None),
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user),
):
    """Фасеты для навигации курса: сколько заданий по каждой (exam, track,
    task_number, topic). Используется деревом тем на фронте."""
    query = db.query(
        ExamTask.exam, ExamTask.track, ExamTask.task_number, ExamTask.topic,
        func.count(ExamTask.id),
    )
    if exam is not None:
        query = query.filter(ExamTask.exam == exam)
    if track is not None:
        query = query.filter(ExamTask.track == track)
    rows = query.group_by(
        ExamTask.exam, ExamTask.track, ExamTask.task_number, ExamTask.topic,
    ).all()
    return [
        ExamTopicFacet(exam=e, track=t, task_number=n, topic=tp, count=c)
        for (e, t, n, tp, c) in rows
    ]


@router.get("/tasks/{task_id}", response_model=ExamTaskPublic)
def get_exam_task(
        task_id: int,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user),
):
    task = db.query(ExamTask).filter(ExamTask.id == task_id).first()
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Задание не найдено")
    return task


@router.get("/next", response_model=ExamTaskPublic)
def next_exam_task(
        exam: Optional[str] = Query(default=None),
        track: Optional[str] = Query(default=None),
        topic: Optional[str] = Query(default=None),
        task_number: Optional[int] = Query(default=None),
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user),
):
    """Что решать дальше: сначала невиденное, потом нерешённое, потом повтор."""
    task = exam_trainer.next_task(
        db, current_user, exam=exam, track=track, topic=topic, task_number=task_number,
    )
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="По этим фильтрам заданий пока нет")
    return task


@router.post("/attempt", response_model=ExamAttemptResult)
def submit_exam_attempt(
        body: ExamAttemptRequest,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user),
):
    """Проверка ответа. Разбор отдаётся и при ошибке — тренажёр учит, а не судит."""
    task = db.query(ExamTask).filter(ExamTask.id == body.task_id).first()
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Задание не найдено")
    result = exam_trainer.submit_attempt(
        db, current_user, task, body.answer, time_spent_ms=body.time_spent_ms,
    )
    return ExamAttemptResult(**result)


@router.get("/progress", response_model=ExamProgress)
def exam_progress(
        exam: Optional[str] = Query(default=None),
        track: Optional[str] = Query(default=None),
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user),
):
    return ExamProgress(**exam_trainer.compute_progress(db, current_user, exam=exam, track=track))
