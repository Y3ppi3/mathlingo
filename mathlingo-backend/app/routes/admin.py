
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel

from app.database import get_db
from app.models import (
    Admin, AuditLog, Diagnostic, Skill, Task, User, Subject, AdventureMap,
)
from app.schemas import (
    AdminAccountResponse, AdminCreate, AdminResponse, AuditLogResponse,
    DiagnosticCreate, DiagnosticResponse, DiagnosticUpdate,
    UserBulkStatusUpdate, UserResponse, SubjectCreate, SubjectUpdate, SubjectResponse, AdminLogin)
from app.auth import get_admin_current_user, get_admin_current_user_optional, create_access_token, hash_password, verify_password, require_role
from app.routes._admin_rbac import CAN_MANAGE_CONTENT
from app.routes.subjects import SUBJECTS_LIST_CACHE_PREFIX
from app.services import cache
from typing import Optional

router = APIRouter(prefix="/admin", tags=["admin"])


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
        current_admin: Admin = Depends(CAN_MANAGE_CONTENT)
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
    cache.delete_prefix(f"{SUBJECTS_LIST_CACHE_PREFIX}:")
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
        current_admin: Admin = Depends(CAN_MANAGE_CONTENT)
):
    """Обновление информации о разделе"""
    db_subject = db.query(Subject).filter(Subject.id == subject_id).first()
    if not db_subject:
        raise HTTPException(status_code=404, detail="Раздел не найден")

    for key, value in subject_update.dict(exclude_unset=True).items():
        setattr(db_subject, key, value)

    db.commit()
    db.refresh(db_subject)
    cache.delete_prefix(f"{SUBJECTS_LIST_CACHE_PREFIX}:")
    return db_subject


@router.delete("/subjects/{subject_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_subject(
        subject_id: int,
        force: bool = False,
        db: Session = Depends(get_db),
        current_admin: Admin = Depends(require_role("superadmin"))
):
    """
    Удаление раздела. Если с разделом связаны задания и force не передан —
    отказывает с confirmation_required, чтобы фронтенд мог переспросить
    подтверждение и повторить запрос с force=true (см. SubjectsPanel.tsx).
    С force=true отвязывает задания и карты приключений перед удалением.
    """
    db_subject = db.query(Subject).filter(Subject.id == subject_id).first()
    if not db_subject:
        raise HTTPException(status_code=404, detail="Раздел не найден")

    # Проверяем, есть ли задания, связанные с этим разделом
    tasks_count = db.query(Task).filter(Task.subject_id == subject_id).count()
    if tasks_count > 0 and not force:
        return JSONResponse(
            status_code=400,
            content={
                "detail": f"Нельзя удалить раздел, так как с ним связано {tasks_count} заданий",
                "status": "confirmation_required",
                "related_data": {"tasks_count": tasks_count},
            },
        )

    if tasks_count > 0:
        db.query(Task).filter(Task.subject_id == subject_id).update(
            {"subject_id": None}, synchronize_session=False
        )

    adventure_maps = db.query(AdventureMap).filter(AdventureMap.subject_id == subject_id).all()
    for adventure_map in adventure_maps:
        adventure_map.subject_id = None

    db.delete(db_subject)
    db.commit()
    cache.delete_prefix(f"{SUBJECTS_LIST_CACHE_PREFIX}:")
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


# --- Диагностика (R2 task 3) ---
# Куратор собирает набор УЖЕ опубликованных заданий темы — отдельного
# review-цикла для диагностики нет, ревью прошли сами задания.

def _validate_diagnostic_tasks(db: Session, skill_id: int, task_ids: List[int]) -> None:
    if not task_ids:
        raise HTTPException(status_code=400, detail="Диагностика не может быть пустой")
    tasks = db.query(Task).filter(Task.id.in_(task_ids)).all()
    found_ids = {t.id for t in tasks}
    missing = set(task_ids) - found_ids
    if missing:
        raise HTTPException(status_code=404, detail=f"Задания не найдены: {sorted(missing)}")
    not_published = [t.id for t in tasks if t.status != "published"]
    if not_published:
        raise HTTPException(status_code=400, detail=f"Задания не опубликованы: {sorted(not_published)}")
    wrong_skill = [t.id for t in tasks if t.skill_id != skill_id]
    if wrong_skill:
        raise HTTPException(status_code=400, detail=f"Задания не относятся к теме: {sorted(wrong_skill)}")


@router.post("/diagnostics", response_model=DiagnosticResponse)
def create_diagnostic(
        body: DiagnosticCreate,
        db: Session = Depends(get_db),
        current_admin: Admin = Depends(CAN_MANAGE_CONTENT),
):
    skill = db.query(Skill).filter(Skill.id == body.skill_id).first()
    if not skill:
        raise HTTPException(status_code=404, detail="Тема не найдена")
    _validate_diagnostic_tasks(db, body.skill_id, body.task_ids)

    diagnostic = Diagnostic(
        skill_id=body.skill_id,
        task_ids=body.task_ids,
        created_by_admin_id=current_admin.id,
    )
    db.add(diagnostic)
    db.commit()
    db.refresh(diagnostic)
    return diagnostic


@router.get("/diagnostics", response_model=List[DiagnosticResponse])
def list_diagnostics(
        skill_id: Optional[int] = None,
        db: Session = Depends(get_db),
        current_admin: Admin = Depends(get_admin_current_user),
):
    query = db.query(Diagnostic)
    if skill_id is not None:
        query = query.filter(Diagnostic.skill_id == skill_id)
    return query.order_by(Diagnostic.id.desc()).all()


@router.put("/diagnostics/{diagnostic_id}", response_model=DiagnosticResponse)
def update_diagnostic(
        diagnostic_id: int,
        body: DiagnosticUpdate,
        db: Session = Depends(get_db),
        current_admin: Admin = Depends(CAN_MANAGE_CONTENT),
):
    diagnostic = db.query(Diagnostic).filter(Diagnostic.id == diagnostic_id).first()
    if not diagnostic:
        raise HTTPException(status_code=404, detail="Диагностика не найдена")

    update_data = body.dict(exclude_unset=True)
    if "task_ids" in update_data:
        _validate_diagnostic_tasks(db, diagnostic.skill_id, update_data["task_ids"])

    for key, value in update_data.items():
        setattr(diagnostic, key, value)

    db.commit()
    db.refresh(diagnostic)
    return diagnostic
