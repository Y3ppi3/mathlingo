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


# R2 task 4: рекомендация уровня с "причиной" + временный выбор соседнего
class LevelOverrideResponse(BaseModel):
    chosen_level: TaskLevel
    reason: str
    expires_at: datetime

    class Config:
        from_attributes = True


class SkillLevelResponse(BaseModel):
    skill_id: int
    computed_level: Optional[TaskLevel] = None
    confidence: int = 0
    sample_size: int = 0
    factors: Optional[Dict[str, Any]] = None
    override: Optional[LevelOverrideResponse] = None
    effective_level: Optional[TaskLevel] = None


class LevelOverrideRequest(BaseModel):
    chosen_level: TaskLevel


# Схемы AI-конвейера (R2 task 5)
TaskType = Literal["single_answer", "multiple_choice"]
AIOrderStatus = Literal["queued", "processing", "completed", "failed"]
AIItemStatus = Literal["pending", "ready", "failed_generation", "failed_validation", "failed_answer_check"]


class PromptTemplateCreate(BaseModel):
    name: str
    template_text: str
    task_type: TaskType
    version: int = 1


class PromptTemplateResponse(BaseModel):
    id: int
    name: str
    version: int
    template_text: str
    task_type: TaskType
    created_at: datetime

    class Config:
        from_attributes = True


class AIGenerationOrderCreate(BaseModel):
    subject_id: int
    skill_id: int
    level: TaskLevel = "standard"
    task_type: TaskType
    count: int
    constraints: Optional[Dict[str, Any]] = None
    prompt_template_id: int


class AIGenerationItemResponse(BaseModel):
    id: int
    index_in_order: int
    status: AIItemStatus
    failure_reason: Optional[str] = None
    draft_json: Optional[Dict[str, Any]] = None
    validation_result: Optional[Dict[str, Any]] = None
    sanitization_result: Optional[Dict[str, Any]] = None
    deterministic_check_result: Optional[Dict[str, Any]] = None
    ai_critic_result: Optional[Dict[str, Any]] = None
    task_id: Optional[int] = None

    class Config:
        from_attributes = True


class AIGenerationOrderResponse(BaseModel):
    id: int
    subject_id: int
    skill_id: int
    level: TaskLevel
    task_type: TaskType
    count: int
    constraints: Optional[Dict[str, Any]] = None
    prompt_template_id: int
    model_version: str
    requested_by_admin_id: Optional[int] = None
    status: AIOrderStatus
    created_at: datetime

    class Config:
        from_attributes = True


class AIGenerationOrderDetailResponse(AIGenerationOrderResponse):
    items: List[AIGenerationItemResponse] = []


# Квоты (R2 task 6)
class AIQuotaResponse(BaseModel):
    admin_id: int
    period: str
    monthly_limit: int
    used: int

    class Config:
        from_attributes = True


class AIQuotaUpdateRequest(BaseModel):
    monthly_limit: int


# Пост-публикационный мониторинг (R2 task 7)
ContentFlagType = Literal["anomaly", "complaint"]
ContentFlagStatus = Literal["open", "resolved", "dismissed"]


class ContentFlagCreate(BaseModel):
    comment: str


class ContentFlagResponse(BaseModel):
    id: int
    task_id: int
    flag_type: ContentFlagType
    details: Optional[Dict[str, Any]] = None
    status: ContentFlagStatus
    created_by_admin_id: Optional[int] = None
    resolved_by_admin_id: Optional[int] = None
    created_at: datetime
    resolved_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ContentFlagUpdate(BaseModel):
    status: Literal["resolved", "dismissed"]


class TaskQualityResponse(BaseModel):
    task_id: int
    title: str
    status: str
    sample_size: int
    accuracy: Optional[float] = None
    avg_time_spent_ms: Optional[float] = None
    avg_hints_used: Optional[float] = None
    open_flags: int
    flags: List[ContentFlagResponse] = []


# Схемы диагностики (R2 task 3)
class DiagnosticCreate(BaseModel):
    skill_id: int
    task_ids: List[int]


class DiagnosticUpdate(BaseModel):
    task_ids: Optional[List[int]] = None
    is_active: Optional[bool] = None


class DiagnosticResponse(BaseModel):
    id: int
    skill_id: int
    task_ids: List[int]
    is_active: bool
    created_by_admin_id: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True


# Игровые сценарии (R3 task 2)
GameTemplateKey = Literal["derivfall", "integralbuilder", "mathlab"]
GameScenarioStatus = Literal["draft", "published", "archived"]


class GameScenarioCreate(BaseModel):
    template_key: GameTemplateKey
    config: Dict[str, Any]
    skill_id: Optional[int] = None
    level_range: Optional[List[int]] = None
    availability_from: Optional[datetime] = None
    availability_to: Optional[datetime] = None


class GameScenarioUpdate(BaseModel):
    config: Optional[Dict[str, Any]] = None
    skill_id: Optional[int] = None
    level_range: Optional[List[int]] = None
    availability_from: Optional[datetime] = None
    availability_to: Optional[datetime] = None


class GameScenarioResponse(BaseModel):
    id: int
    template_key: GameTemplateKey
    config: Dict[str, Any]
    status: GameScenarioStatus
    skill_id: Optional[int] = None
    level_range: Optional[List[int]] = None
    availability_from: Optional[datetime] = None
    availability_to: Optional[datetime] = None
    created_by_admin_id: Optional[int] = None
    preview_passed_at: Optional[datetime] = None
    published_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class GameScenarioChecklistItemResponse(BaseModel):
    item_key: str
    checked_by_admin_id: Optional[int] = None
    checked_at: Optional[datetime] = None


# Student-facing (R3 task 3): активный сценарий шаблона — без
# preview/чек-лист/статусных полей, ученику это не нужно и не должно быть
# видно, что за сценарием стоит workflow модерации.
class ActiveGameScenarioResponse(BaseModel):
    id: int
    template_key: GameTemplateKey
    config: Dict[str, Any]
    level_range: Optional[List[int]] = None


# R3 task 6: итог игровой сессии — одна попытка на всю сессию, см.
# app/services/game_attempts.py.
class GameAttemptSubmissionRequest(BaseModel):
    score: int
    max_score: int
    time_spent_ms: Optional[int] = None


class GameAttemptSubmissionResponse(BaseModel):
    is_correct: bool


# Student-facing: то же самое, что задание в task-groups/data — без
# correct_answer.
class DiagnosticTaskView(BaseModel):
    id: int
    title: str
    content: str
    options: Optional[List[str]] = None
    answer_type: TaskAnswerType


class DiagnosticView(BaseModel):
    id: int
    skill_id: int
    tasks: List[DiagnosticTaskView]


class DiagnosticAnswerItem(BaseModel):
    task_id: int
    answer: str
    time_spent_ms: Optional[int] = None
    hints_used: int = 0


class DiagnosticSubmitRequest(BaseModel):
    answers: List[DiagnosticAnswerItem]


class DiagnosticSubmitResult(BaseModel):
    task_id: int
    is_correct: bool


class DiagnosticSubmitResponse(BaseModel):
    results: List[DiagnosticSubmitResult]
    correct_count: int
    total_count: int
    mastery: MasteryStateResponse


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