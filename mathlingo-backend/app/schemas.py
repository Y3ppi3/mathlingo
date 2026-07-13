from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

AdminRole = Literal["superadmin", "content_manager", "teacher"]


# Схемы для администратора
class AdminBase(BaseModel):
    username: str
    email: EmailStr


class AdminCreate(AdminBase):
    password: str
    # Игнорируется при бутстрапе первого админа (тот всегда становится
    # superadmin). После бутстрапа обязателен — см. register_admin().
    role: Optional[AdminRole] = None


class AdminLogin(BaseModel):
    email: str
    password: str


class AdminResponse(AdminBase):
    id: int
    role: AdminRole
    is_active: bool
    created_at: datetime
    token: str

    class Config:
        from_attributes = True


# Для списков staff-аккаунтов — без token (это не сам вошедший админ, а
# запись в списке, выдавать чужой токен незачем и небезопасно).
class AdminAccountResponse(AdminBase):
    id: int
    role: AdminRole
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class AuditLogResponse(BaseModel):
    id: int
    actor_admin_id: Optional[int] = None
    actor_role: Optional[str] = None
    method: str
    path: str
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None
    action: Optional[str] = None
    status_code: int
    created_at: datetime

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
    avatarId: Optional[int] = None

    class Config:
        from_attributes = True

        field_customization = {
            "avatar_id": "avatarId"  # Имя в БД: имя в JSON
        }


class UserRegisterResponse(UserResponse):
    token: str


TaskLevel = Literal["basic", "standard", "advanced"]
TaskStatus = Literal["draft", "in_review", "needs_revision", "approved", "published", "archived"]
TaskAnswerType = Literal["single_answer", "multiple_choice"]


# Схема заданий
class TaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    subject: str


class TaskCreate(TaskBase):
    owner_id: Optional[int] = None
    skill_id: Optional[int] = None
    level: TaskLevel = "standard"
    content: Optional[str] = None
    answer_type: TaskAnswerType = "single_answer"
    options: Optional[List[str]] = None
    correct_answer: Optional[str] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    subject: Optional[str] = None
    owner_id: Optional[int] = None
    skill_id: Optional[int] = None
    level: Optional[TaskLevel] = None
    content: Optional[str] = None
    answer_type: Optional[TaskAnswerType] = None
    options: Optional[List[str]] = None
    correct_answer: Optional[str] = None


class TaskResponse(TaskBase):
    id: int
    owner_id: Optional[int]
    skill_id: Optional[int] = None
    level: TaskLevel
    status: TaskStatus
    version: int
    source: Literal["manual", "ai"]
    created_by_admin_id: Optional[int] = None
    approved_by_admin_id: Optional[int] = None
    published_at: Optional[datetime] = None
    archived_at: Optional[datetime] = None
    content: Optional[str] = None
    answer_type: TaskAnswerType = "single_answer"
    options: Optional[List[str]] = None
    # correct_answer сознательно ЕСТЬ в admin-схеме (автор должен видеть, что
    # он написал) — но НЕ используется ни в одном student-facing эндпоинте
    # (см. app/routes/gamification.py, там свой облегчённый dict, не эта схема).
    correct_answer: Optional[str] = None

    class Config:
        from_attributes = True


class TaskChangeRequest(BaseModel):
    comment: Optional[str] = None


class TaskBulkActionRequest(BaseModel):
    ids: List[int]
    action: Literal["submit_review", "approve", "request_changes", "publish", "archive"]
    comment: Optional[str] = None


class BulkActionFailure(BaseModel):
    id: int
    detail: str


class TaskBulkActionResult(BaseModel):
    succeeded: List[int]
    failed: List[BulkActionFailure]


class TaskImportRowFailure(BaseModel):
    row: int
    detail: str


class TaskImportResult(BaseModel):
    created: List[int]
    failed: List[TaskImportRowFailure]


class TaskImportRequest(BaseModel):
    rows: List[Dict[str, Any]]


class UserBulkStatusUpdate(BaseModel):
    ids: List[int]
    is_active: bool


class ContentStatusHistoryResponse(BaseModel):
    id: int
    task_id: int
    from_status: Optional[str] = None
    to_status: str
    actor_admin_id: Optional[int] = None
    comment: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class MasteryStateResponse(BaseModel):
    skill_id: int
    level: TaskLevel
    confidence: int
    sample_size: int
    factors: Optional[Dict[str, Any]] = None
    updated_at: datetime

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


# Схемы для тем (Skill) внутри раздела
class SkillBase(BaseModel):
    name: str
    code: str
    order: Optional[int] = 0


class SkillCreate(SkillBase):
    subject_id: int


class SkillUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    order: Optional[int] = None
    is_active: Optional[bool] = None


class SkillResponse(SkillBase):
    id: int
    subject_id: int
    is_active: bool
    created_at: datetime

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
    time_spent_ms: Optional[int] = None
    hints_used: int = 0


class TaskSubmissionResponse(BaseModel):
    isCorrect: bool
    points: Optional[int] = 0
    feedback: Optional[str] = None