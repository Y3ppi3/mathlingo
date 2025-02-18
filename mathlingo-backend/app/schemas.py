from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import List, Optional


# Базовая схема пользователя
class UserBase(BaseModel):
    username: str
    email: EmailStr


class UserLogin(BaseModel):
    email: str
    password: str


class UserLoginResponse(BaseModel):
    id: int
    username: str
    email: str
    token: str


# Схема для создания пользователя (входные данные)
class UserCreate(UserBase):
    password: str


# Схема для ответа пользователю (без пароля)
class UserResponse(UserBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True  # Для корректного преобразования SQLAlchemy -> Pydantic


class UserRegisterResponse(UserResponse):
    token: str


# Схема задачи
class TaskBase(BaseModel):
    title: str
    description: Optional[str] = None


class TaskCreate(TaskBase):
    owner_id: int


class TaskResponse(TaskBase):
    id: int
    owner_id: int

    class Config:
        from_attributes = True
