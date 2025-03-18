from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime

from app.database import Base


# Модель администратора
class Admin(Base):
    __tablename__ = "admins"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


# Модель обычного пользователя
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Связь с заданиями
    tasks = relationship("Task", back_populates="owner")


class Achievement(Base):
    __tablename__ = "achievements"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=False)
    icon_url = Column(String, nullable=False)
    unlock_condition = Column(String, nullable=False)  # JSON строка с условиями


class AdventureMap(Base):
    __tablename__ = "adventure_maps"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(String)
    background_image = Column(String)
    subject_id = Column(Integer, ForeignKey("subjects.id"))


class MapLocation(Base):
    __tablename__ = "map_locations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(String)
    position_x = Column(Integer, nullable=False)
    position_y = Column(Integer, nullable=False)
    icon_url = Column(String)
    unlocked_by_location_id = Column(Integer, ForeignKey("map_locations.id"), nullable=True)
    adventure_map_id = Column(Integer, ForeignKey("adventure_maps.id"))


class TaskGroup(Base):
    __tablename__ = "task_groups"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(String)
    location_id = Column(Integer, ForeignKey("map_locations.id"))
    difficulty = Column(Integer, default=1)
    reward_points = Column(Integer, default=10)


# Модель задания
class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True, nullable=False)
    description = Column(String, nullable=True)
    subject = Column(String, nullable=False)  # Оставляем для обратной совместимости
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=True)  # Новое поле
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Связи
    owner = relationship("User", back_populates="tasks")
    subject_ref = relationship("Subject", back_populates="tasks")
    task_group_id = Column(Integer, ForeignKey("task_groups.id"), nullable=True)
    reward_points = Column(Integer, default=5)
    difficulty_level = Column(Integer, default=1)
    estimated_time_seconds = Column(Integer, default=60)


class UserProgress(Base):
    __tablename__ = "user_progress"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    current_level = Column(Integer, default=1)
    total_points = Column(Integer, default=0)
    completed_locations = Column(String, default="[]")  # JSON массив с ID локаций
    unlocked_achievements = Column(String, default="[]")  # JSON массив с ID достижений


# Модель раздела математики
class Subject(Base):
    __tablename__ = "subjects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    code = Column(String, unique=True, index=True, nullable=False)
    description = Column(String, nullable=True)
    order = Column(Integer, default=0)
    icon = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Связь с заданиями
    tasks = relationship("Task", back_populates="subject_ref")
