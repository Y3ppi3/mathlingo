from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import List, Optional


# Схемы для администратора
class AdminBase(BaseModel):
    username: str
    email: EmailStr


class AdminCreate(AdminBase):
    password: str


class AdminLogin(BaseModel):
    email: str
    password: str


class AdminResponse(AdminBase):
    id: int
    is_active: bool
    created_at: datetime
    token: str

    class Config:
        from_attributes = True


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


# Схема заданий
class TaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    subject: str


class TaskCreate(TaskBase):
    owner_id: Optional[int] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    subject: Optional[str] = None
    owner_id: Optional[int] = None


class TaskResponse(TaskBase):
    id: int
    owner_id: Optional[int]

    class Config:
        from_attributes = True


# Схемы для разделов математики
class SubjectBase(BaseModel):
    name: str
    code: str
    description: Optional[str] = None
    order: Optional[int] = None
    icon: Optional[str] = None


class SubjectCreate(SubjectBase):
    pass

class SubjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    order: Optional[int] = None
    icon: Optional[str] = None
    is_active: Optional[bool] = None


class SubjectResponse(SubjectBase):
    id: int
    is_active: bool
    created_at: datetime
    tasks_count: Optional[int] = None

    class Config:
        from_attributes = True