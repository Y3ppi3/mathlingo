# app/routes/admin_content_quality.py
"""
Пост-публикационный мониторинг: жалобы/аномалии и аналитика качества
AI-контента (R2 task 7) — выделено из admin.py при разбиении по доменам
(R4), см. docs/roadmap/product-technical-plan.md.
"""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database import get_db
from app.models import Admin, ContentFlag, Task
from app.schemas import ContentFlagCreate, ContentFlagResponse, ContentFlagUpdate, TaskQualityResponse
from app.services import content_quality
from app.routes._admin_rbac import CAN_VIEW_QUALITY

router = APIRouter(prefix="/admin", tags=["admin_content_quality"])


@router.post("/tasks/{task_id}/flags", response_model=ContentFlagResponse)
def create_content_flag(
        task_id: int,
        body: ContentFlagCreate,
        db: Session = Depends(get_db),
        current_admin: Admin = Depends(CAN_VIEW_QUALITY),
):
    """
    Жалоба staff на опубликованное задание. В отличие от anomaly (см.
    app/services/content_quality.py) — не меняет статус контента сама по
    себе, только фиксирует сигнал (см. R2 §7 "статус меняет только
    человек"): решение через return_to_review/archive принимает reviewer.
    """
    db_task = db.query(Task).filter(Task.id == task_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")

    flag = ContentFlag(
        task_id=task_id,
        flag_type="complaint",
        status="open",
        details={"comment": body.comment},
        created_by_admin_id=current_admin.id,
    )
    db.add(flag)
    db.commit()
    db.refresh(flag)
    return flag


@router.get("/content-flags", response_model=List[ContentFlagResponse])
def list_content_flags(
        status_filter: Optional[str] = None,
        flag_type: Optional[str] = None,
        task_id: Optional[int] = None,
        db: Session = Depends(get_db),
        current_admin: Admin = Depends(CAN_VIEW_QUALITY),
):
    query = db.query(ContentFlag)
    if status_filter:
        query = query.filter(ContentFlag.status == status_filter)
    if flag_type:
        query = query.filter(ContentFlag.flag_type == flag_type)
    if task_id:
        query = query.filter(ContentFlag.task_id == task_id)
    return query.order_by(ContentFlag.created_at.desc()).all()


@router.put("/content-flags/{flag_id}", response_model=ContentFlagResponse)
def update_content_flag(
        flag_id: int,
        body: ContentFlagUpdate,
        db: Session = Depends(get_db),
        current_admin: Admin = Depends(CAN_VIEW_QUALITY),
):
    flag = db.query(ContentFlag).filter(ContentFlag.id == flag_id).first()
    if not flag:
        raise HTTPException(status_code=404, detail="Flag not found")
    if flag.status != "open":
        raise HTTPException(status_code=409, detail="Флаг уже закрыт")

    flag.status = body.status
    flag.resolved_by_admin_id = current_admin.id
    flag.resolved_at = datetime.utcnow()
    db.commit()
    db.refresh(flag)
    return flag


@router.get("/quality/ai-tasks", response_model=List[TaskQualityResponse])
def list_ai_task_quality(
        db: Session = Depends(get_db),
        current_admin: Admin = Depends(CAN_VIEW_QUALITY),
):
    """Экран «аналитика качества»: агрегаты попыток + флаги по каждому AI-заданию."""
    tasks = db.query(Task).filter(Task.source == "ai", Task.status != "archived").all()

    result = []
    for task in tasks:
        quality = content_quality.compute_task_quality(db, task.id)
        flags = (
            db.query(ContentFlag)
            .filter(ContentFlag.task_id == task.id)
            .order_by(ContentFlag.created_at.desc())
            .all()
        )
        open_flags = sum(1 for f in flags if f.status == "open")
        result.append(TaskQualityResponse(
            task_id=task.id,
            title=task.title,
            status=task.status,
            sample_size=quality["sample_size"],
            accuracy=quality["accuracy"],
            avg_time_spent_ms=quality["avg_time_spent_ms"],
            avg_hints_used=quality["avg_hints_used"],
            open_flags=open_flags,
            flags=flags,
        ))

    # Задания с открытыми флагами и низкой точностью — наверх списка (это
    # и есть "список аномалий" из плана, см. R2 §3).
    result.sort(key=lambda r: (-r.open_flags, r.accuracy if r.accuracy is not None else 1.0))
    return result
