# app/routes/admin_tasks.py
"""
Жизненный цикл заданий (CRUD, переходы статуса, bulk-действия,
импорт/экспорт) — выделено из admin.py при разбиении по доменам (R4),
см. docs/roadmap/product-technical-plan.md.
"""
import csv
import io
from datetime import datetime

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import ValidationError

from app.database import get_db
from app.models import Admin, ContentStatusHistory, Skill, Task, Subject
from app.schemas import (
    BulkActionFailure, TaskBulkActionRequest, TaskBulkActionResult, TaskChangeRequest,
    TaskCreate, TaskImportRequest, TaskImportResult, TaskImportRowFailure, TaskResponse, TaskUpdate,
)
from app.auth import get_admin_current_user, require_role
from app.routes._admin_rbac import CAN_MANAGE_CONTENT

router = APIRouter(prefix="/admin", tags=["admin_tasks"])

# from_status -> (to_status, кто может выполнить переход)
TASK_TRANSITIONS = {
    "submit_review": {"from": {"draft", "needs_revision"}, "to": "in_review", "roles": ("superadmin", "content_manager")},
    "approve": {"from": {"in_review"}, "to": "approved", "roles": ("superadmin", "teacher")},
    "request_changes": {"from": {"in_review"}, "to": "needs_revision", "roles": ("superadmin", "teacher")},
    "publish": {"from": {"approved"}, "to": "published", "roles": ("superadmin", "content_manager")},
    "archive": {"from": {"draft", "in_review", "needs_revision", "approved", "published"}, "to": "archived", "roles": ("superadmin", "content_manager")},
    # R2 task 7: ручной разбор жалобы/аномалии — снять опубликованное
    # задание обратно на проверку. Те же роли, что и publish (симметрично).
    "return_to_review": {"from": {"published"}, "to": "in_review", "roles": ("superadmin", "content_manager")},
}


def _apply_task_transition(
    action: str,
    task_id: int,
    db: Session,
    current_admin: Admin,
    comment: Optional[str] = None,
) -> Task:
    rule = TASK_TRANSITIONS[action]

    db_task = db.query(Task).filter(Task.id == task_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")

    if current_admin.role not in rule["roles"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав для этого перехода статуса",
        )

    if db_task.status not in rule["from"]:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Переход '{action}' недоступен из статуса '{db_task.status}'",
        )

    from_status = db_task.status
    db_task.status = rule["to"]

    if action == "approve":
        db_task.approved_by_admin_id = current_admin.id
    elif action == "publish":
        db_task.published_at = datetime.utcnow()
    elif action == "archive":
        db_task.archived_at = datetime.utcnow()

    db.add(ContentStatusHistory(
        task_id=db_task.id,
        from_status=from_status,
        to_status=db_task.status,
        actor_admin_id=current_admin.id,
        comment=comment,
    ))
    db.commit()
    db.refresh(db_task)
    return db_task


# Получение списка всех заданий (только для админа)
@router.get("/tasks", response_model=List[TaskResponse])
def get_all_tasks(
        skip: int = 0,
        limit: int = 100,
        skill_id: Optional[int] = None,
        status_filter: Optional[str] = None,
        db: Session = Depends(get_db),
        current_admin: Admin = Depends(get_admin_current_user)
):
    query = db.query(Task)
    if skill_id is not None:
        query = query.filter(Task.skill_id == skill_id)
    if status_filter is not None:
        query = query.filter(Task.status == status_filter)
    return query.offset(skip).limit(limit).all()


def _validate_skill_for_subject(db: Session, skill_id: Optional[int], subject_id: Optional[int]) -> None:
    if skill_id is None:
        return
    skill = db.query(Skill).filter(Skill.id == skill_id).first()
    if not skill:
        raise HTTPException(status_code=404, detail="Тема (skill) не найдена")
    if subject_id is not None and skill.subject_id != subject_id:
        raise HTTPException(status_code=400, detail="Тема не относится к указанному разделу")


def _validate_answer_data(answer_type: str, options: Optional[List[str]], correct_answer: Optional[str]) -> None:
    """
    Не требует, чтобы черновик был полностью укомплектован (можно сохранить
    контент раньше ответа) — проверяет только то, что УЖЕ указано, на
    внутреннюю согласованность.
    """
    if answer_type == "multiple_choice" and options is not None and correct_answer is not None:
        if not correct_answer.isdigit() or not (0 <= int(correct_answer) < len(options)):
            raise HTTPException(
                status_code=400,
                detail="correct_answer должен быть индексом (строкой числа) в пределах options",
            )


# Создание нового задания. Всегда стартует как draft — опубликовать можно
# только пройдя submit_review -> approve -> publish.
@router.post("/tasks", response_model=TaskResponse)
def create_task(
        task: TaskCreate,
        db: Session = Depends(get_db),
        current_admin: Admin = Depends(CAN_MANAGE_CONTENT)
):
    subject = db.query(Subject).filter(Subject.code == task.subject).first()
    subject_id = subject.id if subject else None
    _validate_skill_for_subject(db, task.skill_id, subject_id)
    _validate_answer_data(task.answer_type, task.options, task.correct_answer)

    db_task = Task(
        title=task.title,
        description=task.description,
        subject=task.subject,
        subject_id=subject_id,
        owner_id=task.owner_id,
        skill_id=task.skill_id,
        level=task.level,
        content=task.content,
        answer_type=task.answer_type,
        options=task.options,
        correct_answer=task.correct_answer,
        status="draft",
        version=1,
        source="manual",
        created_by_admin_id=current_admin.id,
    )
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task


# Редактирование содержимого задания — только пока статус draft/
# needs_revision. Изменить опубликованный/проверяемый айтем напрямую нельзя:
# это обходило бы весь review-процесс. Для смены статуса — эндпоинты ниже.
@router.put("/tasks/{task_id}", response_model=TaskResponse)
def update_task(
        task_id: int,
        task_update: TaskUpdate,
        db: Session = Depends(get_db),
        current_admin: Admin = Depends(CAN_MANAGE_CONTENT)
):
    db_task = db.query(Task).filter(Task.id == task_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")

    if db_task.status not in ("draft", "needs_revision"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Нельзя редактировать задание в статусе '{db_task.status}' — только draft/needs_revision",
        )

    update_data = task_update.dict(exclude_unset=True)

    if "subject" in update_data:
        subject = db.query(Subject).filter(Subject.code == update_data["subject"]).first()
        if subject:
            update_data["subject_id"] = subject.id

    if "skill_id" in update_data:
        _validate_skill_for_subject(
            db, update_data["skill_id"], update_data.get("subject_id", db_task.subject_id)
        )

    if "answer_type" in update_data or "options" in update_data or "correct_answer" in update_data:
        _validate_answer_data(
            update_data.get("answer_type", db_task.answer_type),
            update_data.get("options", db_task.options),
            update_data.get("correct_answer", db_task.correct_answer),
        )

    for key, value in update_data.items():
        setattr(db_task, key, value)

    db.commit()
    db.refresh(db_task)
    return db_task


@router.post("/tasks/{task_id}/submit-review", response_model=TaskResponse)
def submit_task_for_review(
        task_id: int,
        db: Session = Depends(get_db),
        current_admin: Admin = Depends(get_admin_current_user),
):
    return _apply_task_transition("submit_review", task_id, db, current_admin)


@router.post("/tasks/{task_id}/approve", response_model=TaskResponse)
def approve_task(
        task_id: int,
        db: Session = Depends(get_db),
        current_admin: Admin = Depends(get_admin_current_user),
):
    return _apply_task_transition("approve", task_id, db, current_admin)


@router.post("/tasks/{task_id}/request-changes", response_model=TaskResponse)
def request_task_changes(
        task_id: int,
        body: TaskChangeRequest,
        db: Session = Depends(get_db),
        current_admin: Admin = Depends(get_admin_current_user),
):
    return _apply_task_transition("request_changes", task_id, db, current_admin, comment=body.comment)


@router.post("/tasks/{task_id}/publish", response_model=TaskResponse)
def publish_task(
        task_id: int,
        db: Session = Depends(get_db),
        current_admin: Admin = Depends(get_admin_current_user),
):
    return _apply_task_transition("publish", task_id, db, current_admin)


@router.post("/tasks/{task_id}/archive", response_model=TaskResponse)
def archive_task(
        task_id: int,
        db: Session = Depends(get_db),
        current_admin: Admin = Depends(get_admin_current_user),
):
    return _apply_task_transition("archive", task_id, db, current_admin)


@router.post("/tasks/{task_id}/return-to-review", response_model=TaskResponse)
def return_task_to_review(
        task_id: int,
        db: Session = Depends(get_db),
        current_admin: Admin = Depends(get_admin_current_user),
):
    """R2 task 7: ручной разбор жалобы — снять опубликованное задание на повторную проверку."""
    return _apply_task_transition("return_to_review", task_id, db, current_admin)


# Массовое действие над набором заданий. Каждый id обрабатывается независимо
# (частичный успех — нормальный исход: одно задание может быть не в том
# статусе, остальные при этом всё равно применяются), а не всё-или-ничего —
# так удобнее для модерации большого списка контента.
@router.post("/tasks/bulk", response_model=TaskBulkActionResult)
def bulk_task_action(
        body: TaskBulkActionRequest,
        db: Session = Depends(get_db),
        current_admin: Admin = Depends(get_admin_current_user),
):
    succeeded: List[int] = []
    failed: List[BulkActionFailure] = []
    for task_id in body.ids:
        try:
            _apply_task_transition(body.action, task_id, db, current_admin, comment=body.comment)
            succeeded.append(task_id)
        except HTTPException as e:
            failed.append(BulkActionFailure(id=task_id, detail=str(e.detail)))
    return TaskBulkActionResult(succeeded=succeeded, failed=failed)


_TASK_EXPORT_FIELDS = [
    "id", "title", "description", "subject", "subject_id", "skill_id", "owner_id",
    "level", "status", "version", "source", "created_by_admin_id",
    "approved_by_admin_id", "published_at", "archived_at",
]


@router.get("/tasks/export")
def export_tasks(
        format: str = "json",
        db: Session = Depends(get_db),
        current_admin: Admin = Depends(get_admin_current_user),
):
    tasks = db.query(Task).all()

    if format == "csv":
        buffer = io.StringIO()
        writer = csv.DictWriter(buffer, fieldnames=_TASK_EXPORT_FIELDS)
        writer.writeheader()
        for t in tasks:
            writer.writerow({field: getattr(t, field) for field in _TASK_EXPORT_FIELDS})
        buffer.seek(0)
        return StreamingResponse(
            iter([buffer.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=tasks.csv"},
        )

    if format != "json":
        raise HTTPException(status_code=400, detail="format должен быть 'json' или 'csv'")

    return [{field: getattr(t, field) for field in _TASK_EXPORT_FIELDS} for t in tasks]


def _import_task_row(row: dict, index: int, db: Session, current_admin: Admin):
    """
    Валидация схемой (TaskCreate) перед вставкой — если строка не проходит
    Pydantic-валидацию, дальше она вообще не доходит до Task(...)/db.add().
    Возвращает (created_id, error) — ровно один из двух непустой.
    """
    try:
        item = TaskCreate(**row)
    except ValidationError as e:
        return None, TaskImportRowFailure(row=index, detail=str(e))

    try:
        subject = db.query(Subject).filter(Subject.code == item.subject).first()
        subject_id = subject.id if subject else None
        _validate_skill_for_subject(db, item.skill_id, subject_id)

        db_task = Task(
            title=item.title,
            description=item.description,
            subject=item.subject,
            subject_id=subject_id,
            owner_id=item.owner_id,
            skill_id=item.skill_id,
            level=item.level,
            status="draft",
            version=1,
            source="manual",
            created_by_admin_id=current_admin.id,
        )
        db.add(db_task)
        db.commit()
        db.refresh(db_task)
        return db_task.id, None
    except HTTPException as e:
        db.rollback()
        return None, TaskImportRowFailure(row=index, detail=str(e.detail))


# Импорт из JSON — как и bulk-действия, каждая строка независима: невалидная
# по бизнес-правилам строка (напр. skill из чужого subject) не блокирует
# остальные. Схемная валидация (TaskCreate) — на уровне каждой строки, а не
# всего массива целиком, ради того же партиального успеха.
@router.post("/tasks/import", response_model=TaskImportResult)
def import_tasks_json(
        body: TaskImportRequest,
        db: Session = Depends(get_db),
        current_admin: Admin = Depends(CAN_MANAGE_CONTENT),
):
    created: List[int] = []
    failed: List[TaskImportRowFailure] = []
    for index, row in enumerate(body.rows):
        task_id, error = _import_task_row(row, index, db, current_admin)
        if error:
            failed.append(error)
        else:
            created.append(task_id)
    return TaskImportResult(created=created, failed=failed)


@router.post("/tasks/import-csv", response_model=TaskImportResult)
async def import_tasks_csv(
        file: UploadFile = File(...),
        db: Session = Depends(get_db),
        current_admin: Admin = Depends(CAN_MANAGE_CONTENT),
):
    raw = (await file.read()).decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(raw))

    created: List[int] = []
    failed: List[TaskImportRowFailure] = []
    for index, raw_row in enumerate(reader):
        # Пустая ячейка CSV -> "" -> невалидно для Optional[int] полей
        # (skill_id/owner_id) в Pydantic; приводим "" к None перед валидацией.
        row = {k: (v if v not in (None, "") else None) for k, v in raw_row.items()}
        task_id, error = _import_task_row(row, index, db, current_admin)
        if error:
            failed.append(error)
        else:
            created.append(task_id)
    return TaskImportResult(created=created, failed=failed)


# Необратимое удаление задания — только superadmin. Обычный сценарий вывода
# контента из оборота — archive (см. /tasks/{id}/archive выше), а не delete.
@router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(
        task_id: int,
        db: Session = Depends(get_db),
        current_admin: Admin = Depends(require_role("superadmin"))
):
    db_task = db.query(Task).filter(Task.id == task_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")

    db.delete(db_task)
    db.commit()
    return None
