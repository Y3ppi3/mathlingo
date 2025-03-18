# app/routes/admin_gamification.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import json
from typing import List

from app.database import get_db
from app.models import (
    Admin, User, Task, Subject,
    AdventureMap, MapLocation, TaskGroup,
    Achievement, UserProgress
)
from app.auth import get_admin_current_user
from app.schemas import (
    AdventureMapCreate, AdventureMapResponse,
    LocationCreate, LocationResponse,
    TaskGroupCreate, TaskGroupResponse
)

router = APIRouter(prefix="/admin/gamification", tags=["admin_gamification"])


# --- Маршруты для управления картами приключений ---

@router.post("/maps", response_model=AdventureMapResponse)
def create_map(
    map_data: AdventureMapCreate,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_admin_current_user)
):
    """Создать новую карту приключений"""
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


# --- Маршруты для управления локациями ---

@router.get("/maps/{map_id}/locations", response_model=List[LocationResponse])
def get_locations_by_map(
        map_id: int,
        db: Session = Depends(get_db),
        current_admin: Admin = Depends(get_admin_current_user)
):
    """Получить все локации для конкретной карты"""
    locations = db.query(MapLocation).filter(MapLocation.adventure_map_id == map_id).all()
    return locations


@router.post("/locations", response_model=LocationResponse)
def create_location(
        location_data: LocationCreate,
        db: Session = Depends(get_db),
        current_admin: Admin = Depends(get_admin_current_user)
):
    """Создать новую локацию"""
    # Проверяем существование карты
    adventure_map = db.query(AdventureMap).filter(AdventureMap.id == location_data.adventure_map_id).first()
    if not adventure_map:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Карта не найдена")

    # Проверяем существование разблокирующей локации, если указана
    if location_data.unlocked_by_location_id:
        unlocking_location = db.query(MapLocation).filter(
            MapLocation.id == location_data.unlocked_by_location_id
        ).first()

        if not unlocking_location:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                                detail="Разблокирующая локация не найдена")

        # Проверяем, что разблокирующая локация принадлежит той же карте
        if unlocking_location.adventure_map_id != location_data.adventure_map_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                detail="Разблокирующая локация должна принадлежать той же карте")

    # Создаем локацию
    new_location = MapLocation(**location_data.dict())
    db.add(new_location)
    db.commit()
    db.refresh(new_location)

    return new_location


@router.put("/locations/{location_id}", response_model=LocationResponse)
def update_location(
        location_id: int,
        location_data: LocationCreate,
        db: Session = Depends(get_db),
        current_admin: Admin = Depends(get_admin_current_user)
):
    """Обновить локацию"""
    location = db.query(MapLocation).filter(MapLocation.id == location_id).first()
    if not location:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Локация не найдена")

    # Проверяем, что не создаем цикл зависимостей
    if location_data.unlocked_by_location_id == location_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Локация не может разблокировать сама себя")

    # Обновляем локацию
    for key, value in location_data.dict().items():
        setattr(location, key, value)

    db.commit()
    db.refresh(location)

    return location


@router.delete("/locations/{location_id}")
def delete_location(
        location_id: int,
        db: Session = Depends(get_db),
        current_admin: Admin = Depends(get_admin_current_user)
):
    """Удалить локацию"""
    location = db.query(MapLocation).filter(MapLocation.id == location_id).first()
    if not location:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Локация не найдена")

    # Проверяем, не используется ли локация для разблокировки других локаций
    dependent_locations = db.query(MapLocation).filter(
        MapLocation.unlocked_by_location_id == location_id
    ).all()

    if dependent_locations:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Эта локация используется для разблокировки других локаций")

    # Проверяем, есть ли группы заданий в этой локации
    task_groups = db.query(TaskGroup).filter(TaskGroup.location_id == location_id).all()

    if task_groups:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Сначала удалите все группы заданий в этой локации")

    # Удаляем локацию
    db.delete(location)
    db.commit()

    return {"detail": "Локация успешно удалена"}


# --- Маршруты для управления группами заданий ---

@router.get("/locations/{location_id}/task-groups", response_model=List[TaskGroupResponse])
def get_task_groups_by_location(
        location_id: int,
        db: Session = Depends(get_db),
        current_admin: Admin = Depends(get_admin_current_user)
):
    """Получить все группы заданий для конкретной локации"""
    task_groups = db.query(TaskGroup).filter(TaskGroup.location_id == location_id).all()
    return task_groups


@router.post("/task-groups", response_model=TaskGroupResponse)
def create_task_group(
        task_group_data: TaskGroupCreate,
        db: Session = Depends(get_db),
        current_admin: Admin = Depends(get_admin_current_user)
):
    """Создать новую группу заданий"""
    # Проверяем существование локации
    location = db.query(MapLocation).filter(MapLocation.id == task_group_data.location_id).first()
    if not location:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Локация не найдена")

    # Создаем группу заданий
    new_task_group = TaskGroup(**task_group_data.dict())
    db.add(new_task_group)
    db.commit()
    db.refresh(new_task_group)

    return new_task_group


@router.put("/task-groups/{task_group_id}", response_model=TaskGroupResponse)
def update_task_group(
        task_group_id: int,
        task_group_data: TaskGroupCreate,
        db: Session = Depends(get_db),
        current_admin: Admin = Depends(get_admin_current_user)
):
    """Обновить группу заданий"""
    task_group = db.query(TaskGroup).filter(TaskGroup.id == task_group_id).first()
    if not task_group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Группа заданий не найдена")

    # Обновляем группу заданий
    for key, value in task_group_data.dict().items():
        setattr(task_group, key, value)

    db.commit()
    db.refresh(task_group)

    return task_group


@router.delete("/task-groups/{task_group_id}")
def delete_task_group(
        task_group_id: int,
        db: Session = Depends(get_db),
        current_admin: Admin = Depends(get_admin_current_user)
):
    """Удалить группу заданий"""
    task_group = db.query(TaskGroup).filter(TaskGroup.id == task_group_id).first()
    if not task_group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Группа заданий не найдена")

    # Проверяем, есть ли задания в этой группе
    tasks = db.query(Task).filter(Task.task_group_id == task_group_id).all()

    # Снимаем привязку заданий к группе
    for task in tasks:
        task.task_group_id = None

    # Удаляем группу заданий
    db.delete(task_group)
    db.commit()

    return {"detail": "Группа заданий успешно удалена"}


@router.post("/task-groups/{task_group_id}/assign-tasks")
def assign_tasks_to_group(
        task_group_id: int,
        task_ids: List[int],
        db: Session = Depends(get_db),
        current_admin: Admin = Depends(get_admin_current_user)
):
    """Назначить задания группе"""
    task_group = db.query(TaskGroup).filter(TaskGroup.id == task_group_id).first()
    if not task_group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Группа заданий не найдена")

    # Получаем локацию и карту
    location = db.query(MapLocation).filter(MapLocation.id == task_group.location_id).first()
    if not location:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Локация не найдена")

    adventure_map = db.query(AdventureMap).filter(AdventureMap.id == location.adventure_map_id).first()
    if not adventure_map:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Карта не найдена")

    # Проверяем, что все задания существуют
    tasks = db.query(Task).filter(Task.id.in_(task_ids)).all()
    if len(tasks) != len(task_ids):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Некоторые задания не найдены")

    # Назначаем задания группе
    for task in tasks:
        task.task_group_id = task_group_id

    db.commit()

    return {"detail": f"Успешно назначено {len(tasks)} заданий группе"}


# --- Маршруты для управления достижениями ---

@router.post("/achievements")
def create_achievement(
        achievement_data: dict,
        db: Session = Depends(get_db),
        current_admin: Admin = Depends(get_admin_current_user)
):
    """Создать новое достижение"""
    new_achievement = Achievement(
        name=achievement_data["name"],
        description=achievement_data["description"],
        icon_url=achievement_data["icon_url"],
        unlock_condition=json.dumps(achievement_data["unlock_condition"])
    )

    db.add(new_achievement)
    db.commit()
    db.refresh(new_achievement)

    return new_achievement


@router.delete("/achievements/{achievement_id}")
def delete_achievement(
        achievement_id: int,
        db: Session = Depends(get_db),
        current_admin: Admin = Depends(get_admin_current_user)
):
    """Удалить достижение"""
    achievement = db.query(Achievement).filter(Achievement.id == achievement_id).first()
    if not achievement:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Достижение не найдено")

    # Удаляем достижение
    db.delete(achievement)
    db.commit()

    return {"detail": "Достижение успешно удалено"}