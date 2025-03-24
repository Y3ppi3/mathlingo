
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel

from app.database import get_db
from app.models import Admin, Task, User, Subject, AdventureMap, MapLocation, TaskGroup
from app.schemas import (
    AdminCreate, AdminResponse, TaskCreate, TaskResponse, TaskUpdate,
    AdminLogin, UserResponse, SubjectCreate, SubjectUpdate, SubjectResponse)
from app.auth import get_admin_current_user, create_access_token, hash_password, verify_password

router = APIRouter(prefix="/admin", tags=["admin"])

class UserStatusUpdate(BaseModel):
    is_active: bool


# Регистрация администратора (можно сделать защищенным)
@router.post("/register", response_model=AdminResponse)
def register_admin(admin: AdminCreate, db: Session = Depends(get_db)):
    # Проверка существования пользователя
    db_admin = db.query(Admin).filter(Admin.email == admin.email).first()
    if db_admin:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Создаем нового админа
    hashed_password = hash_password(admin.password)
    db_admin = Admin(
        username=admin.username,
        email=admin.email,
        hashed_password=hashed_password
    )
    db.add(db_admin)
    db.commit()
    db.refresh(db_admin)

    # Генерируем токен
    token = create_access_token(data={"sub": db_admin.email, "role": "admin"})

    # Возвращаем данные нового админа с токеном
    return {"id": db_admin.id, "username": db_admin.username, "email": db_admin.email, "token": token,
            "is_active": db_admin.is_active, "created_at": db_admin.created_at}


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

    token = create_access_token(data={"sub": admin.email, "role": "admin"})
    return {"id": admin.id, "username": admin.username, "email": admin.email, "token": token,
            "is_active": admin.is_active, "created_at": admin.created_at}


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


# Создание нового задания
@router.post("/tasks", response_model=TaskResponse)
def create_task(
        task: TaskCreate,
        db: Session = Depends(get_db),
        current_admin: Admin = Depends(get_admin_current_user)
):
    # Look up the subject by code to get the subject_id
    subject = db.query(Subject).filter(Subject.code == task.subject).first()

    # Create a new task dict with all the task data
    task_data = task.dict()

    # If subject was found, set the subject_id
    if subject:
        task_data["subject_id"] = subject.id

    # Create the task with the updated data
    db_task = Task(**task_data)
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task


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

    # Создаем словарь с данными для обновления
    update_data = task_update.dict(exclude_unset=True)

    # Если обновляется предмет, соответственно обновляем subject_id
    if "subject" in update_data:
        subject = db.query(Subject).filter(Subject.code == update_data["subject"]).first()
        if subject:
            update_data["subject_id"] = subject.id

    # Обновляем поля задания
    for key, value in update_data.items():
        setattr(db_task, key, value)

    db.commit()
    db.refresh(db_task)
    return db_task


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


# Удаление задания
@router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(
        task_id: int,
        db: Session = Depends(get_db),
        current_admin: Admin = Depends(get_admin_current_user)
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