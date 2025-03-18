# app/routes/gamification.py
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
import json
from typing import List, Optional, Union
from datetime import datetime
import jwt
import os
from dotenv import load_dotenv

from app.database import get_db
from app.models import Admin, User, Task, TaskGroup, MapLocation, AdventureMap, UserProgress, Achievement
from app.auth import get_admin_current_user, get_current_user, get_token_from_request
from app.schemas import (
    AdminCreate,
    AdminResponse,
    AdminLogin,
    AdventureMapCreate,
    AdventureMapResponse,
    LocationCreate,
    LocationResponse,
    TaskGroupCreate,
    TaskGroupResponse,
    UserProgressResponse,
    AchievementResponse,
    TaskSubmissionRequest,
    TaskSubmissionResponse
)

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256"

router = APIRouter(tags=["gamification"])


# Функция для получения пользователя или администратора по токену
def get_any_user(request: Request, db: Session = Depends(get_db)):
    """
    Пытается получить пользователя или администратора по токену.
    Сначала проверяет наличие токена администратора, затем токена пользователя.
    """
    token = get_token_from_request(request)

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Токен отсутствует в заголовке и в куки"
        )

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_email = payload.get("sub")
        user_role = payload.get("role")

        # Проверяем, является ли токен административным
        if user_role == "admin":
            admin = db.query(Admin).filter(Admin.email == user_email).first()
            if admin:
                print(f"✅ Авторизован администратор: {admin.email} (ID {admin.id})", flush=True)
                return admin

        # Если не администратор или администратор не найден, проверяем обычного пользователя
        user = db.query(User).filter(User.email == user_email).first()
        if user:
            print(f"✅ Авторизован пользователь: {user.email} (ID {user.id})", flush=True)
            return user

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Пользователь не найден"
        )
    except jwt.JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Недействительный токен авторизации"
        )


# --- Маршруты для карты приключений ---

@router.post("/maps/", response_model=AdventureMapResponse)
def create_map(
        map_data: AdventureMapCreate,
        db: Session = Depends(get_db),
        current_admin: Admin = Depends(get_admin_current_user)
):
    """Создать новую карту приключений (только для администраторов)"""
    new_map = AdventureMap(
        name=map_data.name,
        description=map_data.description,
        background_image=map_data.background_image,
        subject_id=map_data.subject_id
    )
    db.add(new_map)
    db.commit()
    db.refresh(new_map)
    return new_map


@router.get("/maps/{subject_id}", response_model=List[AdventureMapResponse])
def get_maps_by_subject(
        subject_id: int,
        request: Request,
        db: Session = Depends(get_db)
):
    """Получить все карты для указанного предмета"""
    try:
        # Пытаемся аутентифицировать как пользователя, так и администратора
        user = get_any_user(request, db)

        # Получаем карты для указанного предмета
        maps = db.query(AdventureMap).filter(AdventureMap.subject_id == subject_id).all()
        return maps
    except HTTPException as e:
        # Если аутентификация не удалась, но это запрос от админ-панели,
        # пробуем использовать токен из заголовка Authorization
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            try:
                payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
                email = payload.get("sub")
                role = payload.get("role")

                if role == "admin":
                    admin = db.query(Admin).filter(Admin.email == email).first()
                    if admin:
                        print(f"✅ Авторизован администратор через заголовок: {admin.email}", flush=True)
                        maps = db.query(AdventureMap).filter(AdventureMap.subject_id == subject_id).all()
                        return maps
            except:
                pass

        # Если все методы аутентификации не удались, возвращаем ошибку
        raise e


@router.get("/map/{map_id}", response_model=AdventureMapResponse)
def get_map_by_id(
        map_id: int,
        request: Request,
        db: Session = Depends(get_db)
):
    """Получить карту по её идентификатору"""
    # Пытаемся аутентифицировать как пользователя, так и администратора
    user = get_any_user(request, db)

    # Получаем карту по ID
    adventure_map = db.query(AdventureMap).filter(AdventureMap.id == map_id).first()
    if not adventure_map:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Карта не найдена")

    return adventure_map


@router.get("/maps/{map_id}/data")
def get_map_data(
        map_id: int,
        request: Request,
        db: Session = Depends(get_db)
):
    """Получить полные данные карты со всеми локациями и группами заданий"""
    # Аутентификация пользователя или администратора
    user = get_any_user(request, db)

    adventure_map = db.query(AdventureMap).filter(AdventureMap.id == map_id).first()
    if not adventure_map:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Карта не найдена")

    # Получаем все локации для этой карты
    locations = db.query(MapLocation).filter(MapLocation.adventure_map_id == map_id).all()

    # Получаем прогресс пользователя (только если это обычный пользователь, не администратор)
    user_id = getattr(user, 'id', None)
    user_progress = None

    if isinstance(user, User):
        user_progress = db.query(UserProgress).filter(UserProgress.user_id == user.id).first()

        if not user_progress:
            # Создаем запись о прогрессе, если ее нет
            user_progress = UserProgress(
                user_id=user.id,
                current_level=1,
                total_points=0,
                completed_locations="[]",
                unlocked_achievements="[]"
            )
            db.add(user_progress)
            db.commit()
            db.refresh(user_progress)
    else:
        # Для администратора создаем фиктивный прогресс
        user_progress = UserProgress(
            user_id=0,
            current_level=1,
            total_points=0,
            completed_locations="[]",
            unlocked_achievements="[]"
        )

    # Преобразуем JSON-строки в списки
    completed_locations = json.loads(user_progress.completed_locations)
    unlocked_achievements = json.loads(user_progress.unlocked_achievements)

    # Определяем разблокированные локации (первая всегда разблокирована)
    unlocked_locations = []

    for location in locations:
        # Администратор видит все локации
        if isinstance(user, Admin):
            unlocked_locations.append(location.id)
        else:
            # Для обычного пользователя соблюдаем правила разблокировки
            if location.unlocked_by_location_id is None:
                unlocked_locations.append(location.id)
            elif location.unlocked_by_location_id in completed_locations:
                unlocked_locations.append(location.id)

    # Получаем группы заданий для каждой локации
    location_data = []
    for location in locations:
        task_groups = db.query(TaskGroup).filter(TaskGroup.location_id == location.id).all()

        # Получаем задания для каждой группы
        task_group_data = []
        for group in task_groups:
            tasks = db.query(Task).filter(Task.task_group_id == group.id).all()
            task_ids = [task.id for task in tasks]

            task_group_data.append({
                "id": group.id,
                "name": group.name,
                "description": group.description,
                "difficulty": group.difficulty,
                "reward_points": group.reward_points,
                "tasks": task_ids
            })

        location_data.append({
            "id": location.id,
            "name": location.name,
            "description": location.description,
            "position_x": location.position_x,
            "position_y": location.position_y,
            "icon_url": location.icon_url,
            "taskGroups": task_group_data
        })

    # Формируем ответ
    response = {
        "map": {
            "id": adventure_map.id,
            "name": adventure_map.name,
            "description": adventure_map.description,
            "background_image": adventure_map.background_image,
            "subject_id": adventure_map.subject_id,
            "locations": location_data
        },
        "userProgress": {
            "level": user_progress.current_level,
            "totalPoints": user_progress.total_points,
            "completedLocations": completed_locations,
            "unlockedLocations": unlocked_locations,
            "unlockedAchievements": unlocked_achievements
        }
    }

    return response