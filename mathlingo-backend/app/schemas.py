from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import List, Optional

# Базовая схема пользователя
class UserBase(BaseModel):
    username: str
    email: EmailStr

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

# Схема задачи
class TaskBase(BaseModel):
    title: str
    description: Optional[str] = None

class TaskCreate(TaskBase):
    pass

class TaskResponse(TaskBase):
    id: int
    owner_id: int

    class Config:
        from_attributes = True
