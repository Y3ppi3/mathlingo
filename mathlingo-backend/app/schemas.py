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


class AchievementBase(BaseModel):
    name: str
    description: str
    icon_url: str
    unlock_condition: str  # JSON строка с условиями


class AchievementCreate(AchievementBase):
    pass


class AchievementResponse(AchievementBase):
    id: int

    class Config:
        from_attributes = True


# Схемы для карты приключений
class AdventureMapBase(BaseModel):
    name: str
    description: Optional[str] = None
    background_image: Optional[str] = None
    subject_id: int


class AdventureMapCreate(AdventureMapBase):
    pass


class AdventureMapResponse(AdventureMapBase):
    id: int

    class Config:
        from_attributes = True


# Схемы для локаций
class LocationBase(BaseModel):
    name: str
    description: Optional[str] = None
    position_x: int
    position_y: int
    icon_url: Optional[str] = None
    unlocked_by_location_id: Optional[int] = None
    adventure_map_id: int


class LocationCreate(LocationBase):
    pass


class LocationResponse(LocationBase):
    id: int

    class Config:
        from_attributes = True


# Схемы для групп заданий
class TaskGroupBase(BaseModel):
    name: str
    description: Optional[str] = None
    location_id: int
    difficulty: Optional[int] = 1
    reward_points: Optional[int] = 10


class TaskGroupCreate(TaskGroupBase):
    pass


class TaskGroupResponse(TaskGroupBase):
    id: int

    class Config:
        from_attributes = True


# Схемы для прогресса пользователя
class UserProgressBase(BaseModel):
    user_id: int
    current_level: Optional[int] = 1
    total_points: Optional[int] = 0
    completed_locations: Optional[str] = "[]"
    unlocked_achievements: Optional[str] = "[]"


class UserProgressCreate(UserProgressBase):
    pass


class UserProgressResponse(UserProgressBase):
    id: int

    class Config:
        from_attributes = True


# Схемы для отправки ответов на задания
class TaskSubmissionRequest(BaseModel):
    task_id: int
    answer: str


class TaskSubmissionResponse(BaseModel):
    isCorrect: bool
    points: Optional[int] = 0
    feedback: Optional[str] = None