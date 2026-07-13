
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel

from app.database import get_db
from app.models import Admin, ContentStatusHistory, Task, User, Subject, AdventureMap, MapLocation, TaskGroup
from app.schemas import (
    AdminCreate, AdminResponse, TaskChangeRequest, TaskCreate, TaskResponse, TaskUpdate,
    AdminLogin, UserResponse, SubjectCreate, SubjectUpdate, SubjectResponse)
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


@router.put("/users/{user_id}/status")
def update_user_status(
        user_id: int,
        status_update: UserStatusUpdate,  # Используем модель Pydantic
        db: Session = Depends(get_db),
        current_admin: Admin = Depends(get_admin_current_user)
):
    """Обновление статуса пользователя"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    user.is_active = status_update.is_active  # Используем is_active из модели
    db.commit()
    return {"message": f"Пользователь {'активирован' if status_update.is_active else 'деактивирован'} успешно"}


@router.delete("/users/{user_id}")
def delete_user(
        user_id: int,
        db: Session = Depends(get_db),
        current_admin: Admin = Depends(get_admin_current_user)
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