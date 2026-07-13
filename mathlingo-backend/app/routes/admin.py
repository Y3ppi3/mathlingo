
import csv
import io
from datetime import datetime

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel, ValidationError

from app.database import get_db
from app.models import Admin, AuditLog, ContentStatusHistory, Task, User, Subject, AdventureMap, MapLocation, TaskGroup
from app.schemas import (
    AdminAccountResponse, AdminCreate, AdminResponse, AuditLogResponse, BulkActionFailure,
    TaskBulkActionRequest, TaskBulkActionResult, TaskChangeRequest, TaskCreate, TaskImportRequest,
    TaskImportResult, TaskImportRowFailure, TaskResponse, TaskUpdate, AdminLogin,
    UserBulkStatusUpdate, UserResponse, SubjectCreate, SubjectUpdate, SubjectResponse)
from app.auth import get_admin_current_user, get_admin_current_user_optional, create_access_token, hash_password, verify_password, require_role
from typing import Optional

router = APIRouter(prefix="/admin", tags=["admin"])

# Создание/редактирование/публикация/архивация контента — superadmin и
# content_manager. Approve/request-changes — намеренно НЕ content_manager
# (four-eyes: автор черновика не проверяет сам себя), см.
# docs/roadmap/product-technical-plan.md (R1, §5).
CAN_MANAGE_CONTENT = require_role("superadmin", "content_manager")
CAN_REVIEW_CONTENT = require_role("superadmin", "teacher")

# from_status -> (to_status, кто может выполнить переход)
TASK_TRANSITIONS = {
    "submit_review": {"from": {"draft", "needs_revision"}, "to": "in_review", "roles": ("superadmin", "content_manager")},
    "approve": {"from": {"in_review"}, "to": "approved", "roles": ("superadmin", "teacher")},
    "request_changes": {"from": {"in_review"}, "to": "needs_revision", "roles": ("superadmin", "teacher")},
    "publish": {"from": {"approved"}, "to": "published", "roles": ("superadmin", "content_manager")},
    "archive": {"from": {"draft", "in_review", "needs_revision", "approved", "published"}, "to": "archived", "roles": ("superadmin", "content_manager")},
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


class UserStatusUpdate(BaseModel):
    is_active: bool


# Регистрация администратора.
# Разрешена БЕЗ авторизации только пока в БД нет ни одного админа (bootstrap
# первого администратора при первом деплое). Как только хотя бы один админ
# существует, создавать новых админов может только уже авторизованный админ.
@router.post("/register", response_model=AdminResponse)
def register_admin(
    admin: AdminCreate,
    db: Session = Depends(get_db),
    current_admin: Optional[Admin] = Depends(get_admin_current_user_optional),
):
    admins_exist = db.query(Admin).first() is not None

    if not admins_exist:
        # Бутстрап первого админа: всегда superadmin, роль из запроса
        # игнорируется — иначе первый же вызов мог бы создать учётку с
        # заниженными правами или (хуже) кто-то мог бы претендовать на
        # произвольную роль до появления хоть одного проверяющего.
        role = "superadmin"
    else:
        if current_admin is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Регистрация нового администратора требует авторизации существующего администратора",
            )
        if current_admin.role != "superadmin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Только superadmin может создавать новых администраторов",
            )
        if admin.role is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Укажите роль нового администратора (superadmin/content_manager/teacher)",
            )
        role = admin.role

    # Проверка существования пользователя
    db_admin = db.query(Admin).filter(Admin.email == admin.email).first()
    if db_admin:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Создаем нового админа
    hashed_password = hash_password(admin.password)
    db_admin = Admin(
        username=admin.username,
        email=admin.email,
        hashed_password=hashed_password,
        role=role,
    )
    db.add(db_admin)
    db.commit()
    db.refresh(db_admin)

    # Генерируем токен. "role": "admin" — служебный claim, по которому
    # get_admin_current_user отличает admin-токен от user-токена, НЕ путать
    # с RBAC-ролью — та передаётся отдельным полем admin_role и в любом
    # случае перепроверяется на сервере по Admin.role, а не по токену.
    token = create_access_token(data={"sub": db_admin.email, "role": "admin", "admin_role": db_admin.role})

    return {"id": db_admin.id, "username": db_admin.username, "email": db_admin.email, "role": db_admin.role,
            "token": token, "is_active": db_admin.is_active, "created_at": db_admin.created_at}


# Вход администратора
@router.post("/login", response_model=AdminResponse)
def login_admin(admin_data: AdminLogin, db: Session = Depends(get_db)):
    admin = db.query(Admin).filter(Admin.email == admin_data.email).first()
    if not admin or not verify_password(admin_data.password, admin.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = create_access_token(data={"sub": admin.email, "role": "admin", "admin_role": admin.role})
    return {"id": admin.id, "username": admin.username, "email": admin.email, "role": admin.role,
            "token": token, "is_active": admin.is_active, "created_at": admin.created_at}


# Получение списка всех заданий (только для админа)
@router.get("/tasks", response_model=List[TaskResponse])
def get_all_tasks(
        skip: int = 0,
        limit: int = 100,
        db: Session = Depends(get_db),
        current_admin: Admin = Depends(get_admin_current_user)
):
    tasks = db.query(Task).offset(skip).limit(limit).all()
    return tasks


def _validate_skill_for_subject(db: Session, skill_id: Optional[int], subject_id: Optional[int]) -> None:
    if skill_id is None:
        return
    from app.models import Skill
    skill = db.query(Skill).filter(Skill.id == skill_id).first()
    if not skill:
        raise HTTPException(status_code=404, detail="Тема (skill) не найдена")
    if subject_id is not None and skill.subject_id != subject_id:
        raise HTTPException(status_code=400, detail="Тема не относится к указанному разделу")


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

    db_task = Task(
        title=task.title,
        description=task.description,
        subject=task.subject,
        subject_id=subject_id,
        owner_id=task.owner_id,
        skill_id=task.skill_id,
        level=task.level,
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


'''
@router.put("/tasks/{task_id}", response_model=TaskResponse)
def update_task(
        task_id: int,
        task_update: TaskUpdate,
        db: Session = Depends(get_db),
        current_admin: Admin = Depends(get_admin_current_user)
):
    db_task = db.query(Task).filter(Task.id == task_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")

    for key, value in task_update.dict(exclude_unset=True).items():
        setattr(db_task, key, value)

    db.commit()
    db.refresh(db_task)
    return db_task
'''


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


# Получение списка всех пользователей (для админа)
@router.get("/users", response_model=List[UserResponse])
def get_all_users(
        skip: int = 0,
        limit: int = 100,
        db: Session = Depends(get_db),
        current_admin: Admin = Depends(get_admin_current_user)
):
    users = db.query(User).offset(skip).limit(limit).all()
    return users


@router.get("/subjects", response_model=List[SubjectResponse])
def get_all_subjects(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_admin_current_user)
):
    """Получение списка всех разделов математики с подсчетом заданий"""
    subjects = db.query(Subject).offset(skip).limit(limit).all()

    # Точный подсчет заданий для каждого раздела
    for subject in subjects:
        subject.tasks_count = db.query(Task).filter(
            Task.subject_id == subject.id  # Используем subject_id
        ).count()

    return subjects


@router.post("/subjects", response_model=SubjectResponse)
def create_subject(
        subject: SubjectCreate,
        db: Session = Depends(get_db),
        current_admin: User = Depends(get_admin_current_user)
):
    """Создание нового раздела математики"""
    # Проверка на уникальность кода раздела
    existing = db.query(Subject).filter(Subject.code == subject.code).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Раздел с кодом '{subject.code}' уже существует"
        )

    db_subject = Subject(**subject.dict())
    db.add(db_subject)
    db.commit()
    db.refresh(db_subject)
    return db_subject


@router.get("/subjects/{subject_id}", response_model=SubjectResponse)
def get_subject(
        subject_id: int,
        db: Session = Depends(get_db),
        current_admin: User = Depends(get_admin_current_user)
):
    """Получение информации о разделе по ID"""
    subject = db.query(Subject).filter(Subject.id == subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Раздел не найден")

    # Подсчет количества заданий
    subject.tasks_count = db.query(Task).filter(Task.subject_id == subject.id).count()

    return subject


@router.put("/subjects/{subject_id}", response_model=SubjectResponse)
def update_subject(
        subject_id: int,
        subject_update: SubjectUpdate,
        db: Session = Depends(get_db),
        current_admin: User = Depends(get_admin_current_user)
):
    """Обновление информации о разделе"""
    db_subject = db.query(Subject).filter(Subject.id == subject_id).first()
    if not db_subject:
        raise HTTPException(status_code=404, detail="Раздел не найден")

    for key, value in subject_update.dict(exclude_unset=True).items():
        setattr(db_subject, key, value)

    db.commit()
    db.refresh(db_subject)
    return db_subject


@router.delete("/subjects/{subject_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_subject(
        subject_id: int,
        db: Session = Depends(get_db),
        current_admin: User = Depends(get_admin_current_user)
):
    """Удаление раздела"""
    db_subject = db.query(Subject).filter(Subject.id == subject_id).first()
    if not db_subject:
        raise HTTPException(status_code=404, detail="Раздел не найден")

    # Проверяем, есть ли задания, связанные с этим разделом
    tasks_count = db.query(Task).filter(Task.subject_id == subject_id).count()
    if tasks_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Нельзя удалить раздел, так как с ним связано {tasks_count} заданий"
        )

    db.delete(db_subject)
    db.commit()
    return None


# Управление учётками пользователей — только superadmin. teacher/content_manager
# работают с учащимися только на чтение (просмотр прогресса), см.
# docs/roadmap/product-technical-plan.md (R1, §5). Тронуто заодно с bulk-status
# ниже, чтобы не оставлять одиночный и массовый эндпоинты с разными правами.
@router.put("/users/{user_id}/status")
def update_user_status(
        user_id: int,
        status_update: UserStatusUpdate,  # Используем модель Pydantic
        db: Session = Depends(get_db),
        current_admin: Admin = Depends(require_role("superadmin"))
):
    """Обновление статуса пользователя"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    user.is_active = status_update.is_active  # Используем is_active из модели
    db.commit()
    return {"message": f"Пользователь {'активирован' if status_update.is_active else 'деактивирован'} успешно"}


@router.post("/users/bulk-status")
def bulk_update_user_status(
        body: UserBulkStatusUpdate,
        db: Session = Depends(get_db),
        current_admin: Admin = Depends(require_role("superadmin")),
):
    updated = (
        db.query(User)
        .filter(User.id.in_(body.ids))
        .update({"is_active": body.is_active}, synchronize_session=False)
    )
    db.commit()
    return {"updated_count": updated}


@router.delete("/users/{user_id}")
def delete_user(
        user_id: int,
        db: Session = Depends(get_db),
        current_admin: Admin = Depends(require_role("superadmin"))
):
    """Delete a user"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Optional: Handle related tasks
    db.query(Task).filter(Task.owner_id == user_id).update({Task.owner_id: None})

    db.delete(user)
    db.commit()
    return {"message": "User deleted successfully"}


@router.delete("/subjects/{subject_id}")
def admin_delete_subject(
        subject_id: int,
        force: bool = False,
        db: Session = Depends(get_db),
        current_admin: User = Depends(get_admin_current_user)
):
    """Удаление раздела с поддержкой параметра force для каскадного удаления"""
    # Проверяем существование раздела
    db_subject = db.query(Subject).filter(Subject.id == subject_id).first()
    if not db_subject:
        raise HTTPException(status_code=404, detail="Раздел не найден")

    # Проверяем наличие связанных заданий
    tasks_count = db.query(Task).filter(Task.subject_id == subject_id).count()

    # Если есть связанные задания и параметр force не установлен, возвращаем ошибку
    if tasks_count > 0 and not force:
        return JSONResponse(
            status_code=400,
            content={"detail": f"Нельзя удалить раздел, так как с ним связано {tasks_count} заданий",
                     "status": "confirmation_required",
                     "related_data": {"tasks_count": tasks_count}}
        )

    try:
        # Если force=True или нет связанных заданий, выполняем удаление

        # 1. Отвязываем все связанные задания
        if tasks_count > 0:
            db.query(Task).filter(Task.subject_id == subject_id).update(
                {"subject_id": None}, synchronize_session=False
            )
            db.commit()

        # 2. Отвязываем все связанные карты приключений (необходимо добавить импорт AdventureMap)
        adventure_maps = db.query(AdventureMap).filter(AdventureMap.subject_id == subject_id).all()
        for adventure_map in adventure_maps:
            adventure_map.subject_id = None
        if adventure_maps:
            db.commit()

        # 3. Удаляем раздел
        db.delete(db_subject)
        db.commit()

        return {"status": "success", "detail": "Раздел успешно удален"}

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Ошибка при удалении раздела: {str(e)}"
        )


# Список staff-аккаунтов для зоны "Пользователи и роли" — управление ролями
# целиком в руках superadmin, поэтому и список только для superadmin.
@router.get("/admins", response_model=List[AdminAccountResponse])
def list_admins(
        db: Session = Depends(get_db),
        current_admin: Admin = Depends(require_role("superadmin")),
):
    return db.query(Admin).order_by(Admin.id).all()


# Просмотр аудита: superadmin видит всё, content_manager — только свои
# действия, teacher не видит вовсе (см. docs/roadmap/product-technical-plan.md,
# R1 §5 — "Просмотр аудита | ✅ | частично (свои действия) | ❌").
@router.get("/audit-log", response_model=List[AuditLogResponse])
def list_audit_log(
        skip: int = 0,
        limit: int = 100,
        entity_type: Optional[str] = None,
        actor_admin_id: Optional[int] = None,
        db: Session = Depends(get_db),
        current_admin: Admin = Depends(get_admin_current_user),
):
    if current_admin.role == "teacher":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Аудит недоступен для роли teacher")

    if current_admin.role == "content_manager":
        if actor_admin_id is not None and actor_admin_id != current_admin.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Доступны только свои действия")
        actor_admin_id = current_admin.id

    query = db.query(AuditLog)
    if entity_type is not None:
        query = query.filter(AuditLog.entity_type == entity_type)
    if actor_admin_id is not None:
        query = query.filter(AuditLog.actor_admin_id == actor_admin_id)

    return query.order_by(AuditLog.id.desc()).offset(skip).limit(limit).all()