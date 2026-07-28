# app/routes/admin_exam.py
"""
Ф1 контент-бэкбона: управление банком ЕГЭ/ОГЭ в админке — импорт/экспорт
портируемых контент-паков (перенос на другой компьютер одним файлом) и
статистика. Живёт под /admin (вне CSRF, adminToken Bearer). Правит контент —
роль как у управления контентом (CAN_MANAGE_CONTENT); статистику может смотреть
и просмотрщик качества.
"""
from typing import Optional

from fastapi import APIRouter, Depends, File, Query, UploadFile
from fastapi.responses import PlainTextResponse
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Admin, ExamTask
from app.routes._admin_rbac import CAN_MANAGE_CONTENT, CAN_VIEW_QUALITY
from app.schemas import (
    ExamBankStats, ExamGenerateRequest, ExamGenerateResult,
    ExamImportResult, ExamTopicFacet,
)
from app.services import content_pack, exam_generator

router = APIRouter(prefix="/admin/exam", tags=["admin_exam"])


@router.post("/import", response_model=ExamImportResult)
async def import_exam_pack(
        file: UploadFile = File(...),
        db: Session = Depends(get_db),
        current_admin: Admin = Depends(CAN_MANAGE_CONTENT),
):
    """Загрузка контент-пака (NDJSON). Идемпотентно по external_id — повторная
    загрузка того же пака не плодит дублей."""
    raw = await file.read()
    text = raw.decode("utf-8", errors="replace")
    result = content_pack.import_pack(db, text)
    return ExamImportResult(**result)


@router.post("/generate", response_model=ExamGenerateResult)
def generate_exam_tasks(
        body: ExamGenerateRequest,
        db: Session = Depends(get_db),
        current_admin: Admin = Depends(CAN_MANAGE_CONTENT),
):
    """AI-генерация заданий в банк (source="ai"). Пока реального провайдера нет —
    работает через процедурные оригинальные шаблоны (exam_generator.py); когда
    появится ключ, LLM подключается там же без смены этого эндпоинта."""
    result = exam_generator.generate(
        db, exam=body.exam, track=body.track, count=body.count,
        topics=body.topics, seed=body.seed,
    )
    return ExamGenerateResult(**result)


@router.get("/export", response_class=PlainTextResponse)
def export_exam_pack(
        exam: Optional[str] = Query(default=None),
        track: Optional[str] = Query(default=None),
        source: Optional[str] = Query(default=None),
        db: Session = Depends(get_db),
        current_admin: Admin = Depends(CAN_MANAGE_CONTENT),
):
    """Скачать срез банка как контент-пак (NDJSON-файл)."""
    text = content_pack.export_pack(db, exam=exam, track=track, source=source)
    return PlainTextResponse(
        content=text,
        media_type="application/x-ndjson",
        headers={"Content-Disposition": 'attachment; filename="exam-pack.ndjson"'},
    )


@router.get("/stats", response_model=ExamBankStats)
def exam_bank_stats(
        db: Session = Depends(get_db),
        current_admin: Admin = Depends(CAN_VIEW_QUALITY),
):
    total = db.query(func.count(ExamTask.id)).scalar() or 0
    by_exam = dict(db.query(ExamTask.exam, func.count(ExamTask.id)).group_by(ExamTask.exam).all())
    by_source = dict(db.query(ExamTask.source, func.count(ExamTask.id)).group_by(ExamTask.source).all())
    topic_rows = (
        db.query(ExamTask.exam, ExamTask.track, ExamTask.task_number, ExamTask.topic, func.count(ExamTask.id))
        .group_by(ExamTask.exam, ExamTask.track, ExamTask.task_number, ExamTask.topic)
        .all()
    )
    topics = [
        ExamTopicFacet(exam=e, track=t, task_number=n, topic=tp, count=c)
        for (e, t, n, tp, c) in topic_rows
    ]
    return ExamBankStats(total=total, by_exam=by_exam, by_source=by_source, topics=topics)
