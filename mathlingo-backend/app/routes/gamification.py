# app/routes/gamification.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import json
from typing import List, Optional
from datetime import datetime

from app.database import get_db
from app.models import Admin, User, Task, TaskGroup, MapLocation, AdventureMap, UserProgress, Achievement
from app.auth import get_admin_current_user, get_current_user
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

router = APIRouter(tags=["gamification"])


# --- Маршруты для карты приключений ---

@router.post("/maps/", response_model=AdventureMapResponse)
def create_map(
        map_data: AdventureMapCreate,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_admin_current_user)
):
    # Проверяем, является ли текущий пользователь администратором
    db_admin = db.query(Admin).filter(Admin.email == current_user.email).first()
    if not db_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Только администраторы могут создавать карты"
        )
    # Остальной код без изменений
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
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    maps = db.query(AdventureMap).filter(AdventureMap.subject_id == subject_id).all()
    return maps


@router.get("/maps/{map_id}/data")
def get_map_data(
        map_id: int,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Получить полные данные карты со всеми локациями и группами заданий"""
    adventure_map = db.query(AdventureMap).filter(AdventureMap.id == map_id).first()
    if not adventure_map:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Карта не найдена")

    # Получаем все локации для этой карты
    locations = db.query(MapLocation).filter(MapLocation.adventure_map_id == map_id).all()

    # Получаем прогресс пользователя
    user_progress = db.query(UserProgress).filter(UserProgress.user_id == current_user.id).first()

    if not user_progress:
        # Создаем запись о прогрессе, если ее нет
        user_progress = UserProgress(
            user_id=current_user.id,
            current_level=1,
            total_points=0,
            completed_locations="[]",
            unlocked_achievements="[]"
        )
        db.add(user_progress)
        db.commit()
        db.refresh(user_progress)

    # Преобразуем JSON-строки в списки
    completed_locations = json.loads(user_progress.completed_locations)
    unlocked_achievements = json.loads(user_progress.unlocked_achievements)

    # Определяем разблокированные локации (первая всегда разблокирована)
    unlocked_locations = []

    for location in locations:
        # Первая локация (или локация без зависимостей) всегда разблокирована
        if location.unlocked_by_location_id is None:
            unlocked_locations.append(location.id)
        # Другие локации разблокируются, если их "родительская" локация завершена
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


# --- Маршруты для групп заданий ---

@router.get("/task-groups/{group_id}")
def get_task_group(
        group_id: int,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Получить данные о группе заданий и всех заданиях в ней"""
    task_group = db.query(TaskGroup).filter(TaskGroup.id == group_id).first()
    if not task_group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Группа заданий не найдена")

    # Получаем локацию
    location = db.query(MapLocation).filter(MapLocation.id == task_group.location_id).first()
    if not location:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Локация не найдена")

    # Получаем карту
    adventure_map = db.query(AdventureMap).filter(AdventureMap.id == location.adventure_map_id).first()

    # Получаем все задания для этой группы
    tasks = db.query(Task).filter(Task.task_group_id == group_id).all()

    # Преобразуем задания в нужный формат
    task_data = []
    for task in tasks:
        task_data.append({
            "id": task.id,
            "title": task.title,
            "content": task.description,
            "answer_type": "text",  # По умолчанию текстовый ответ, можно расширить модель
            "difficulty_level": task.difficulty_level,
            "reward_points": task.reward_points,
            "estimated_time_seconds": task.estimated_time_seconds
        })

    # Формируем ответ
    response = {
        "id": task_group.id,
        "name": task_group.name,
        "description": task_group.description,
        "locationName": location.name,
        "subjectId": adventure_map.subject_id if adventure_map else None,
        "tasks": task_data,
        "totalPoints": sum(task.reward_points for task in tasks)
    }

    return response


@router.post("/submit-answer", response_model=TaskSubmissionResponse)
def submit_task_answer(
        submission: TaskSubmissionRequest,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Отправить ответ на задание и получить результат"""
    task = db.query(Task).filter(Task.id == submission.task_id).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Задание не найдено")

    # Здесь должна быть логика проверки правильности ответа
    # Для примера просто возвращаем результат
    is_correct = True  # Реализовать настоящую проверку

    # Обновляем прогресс пользователя, если ответ верный
    if is_correct:
        user_progress = db.query(UserProgress).filter(UserProgress.user_id == current_user.id).first()
        if not user_progress:
            user_progress = UserProgress(
                user_id=current_user.id,
                current_level=1,
                total_points=0,
                completed_locations="[]",
                unlocked_achievements="[]"
            )
            db.add(user_progress)

        # Добавляем очки
        user_progress.total_points += task.reward_points

        # Проверяем, нужно ли повысить уровень
        # Простая формула: уровень = 1 + (очки / 100)
        new_level = 1 + (user_progress.total_points // 100)
        if new_level > user_progress.current_level:
            user_progress.current_level = new_level

        db.commit()

    return TaskSubmissionResponse(
        isCorrect=is_correct,
        points=task.reward_points if is_correct else 0,
        feedback="Отлично! Ответ правильный." if is_correct else "К сожалению, ответ неверный. Попробуйте еще раз."
    )


# --- Маршруты для достижений ---

@router.get("/achievements", response_model=List[AchievementResponse])
def get_achievements(
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Получить список всех достижений"""
    achievements = db.query(Achievement).all()
    return achievements


@router.get("/achievements/user", response_model=List[AchievementResponse])
def get_user_achievements(
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Получить список достижений пользователя"""
    user_progress = db.query(UserProgress).filter(UserProgress.user_id == current_user.id).first()

    if not user_progress:
        return []

    unlocked_achievements = json.loads(user_progress.unlocked_achievements)
    achievements = db.query(Achievement).filter(Achievement.id.in_(unlocked_achievements)).all()

    return achievements