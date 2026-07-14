from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, UniqueConstraint, JSON
from sqlalchemy.orm import relationship
from datetime import datetime

from app.database import Base


# Модель администратора
class Admin(Base):
    __tablename__ = "admins"

    # superadmin | content_manager | teacher — см. require_role() в app/auth.py.
    # Без Python-level default: роль должна назначаться явно в коде создания
    # админа, а не подставляться молча.
    ROLES = ("superadmin", "content_manager", "teacher")

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, nullable=False)
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
    avatar_id = Column(Integer, nullable=True)
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

    LEVELS = ("basic", "standard", "advanced")
    # draft -> in_review -> approved -> published; in_review/approved могут
    # уйти в needs_revision и вернуться в in_review. archived — терминальный
    # статус, заменяет удаление. См. docs/roadmap/product-technical-plan.md
    # (R1, §1.2) и require_role() в app/auth.py для прав на переходы.
    STATUSES = ("draft", "in_review", "needs_revision", "approved", "published", "archived")
    SOURCES = ("manual", "ai")
    # R2 AI-generation decisions: "первый набор типов — с одним ответом и
    # multiple choice". single_answer сравнивается как строка (case/пробелы
    # игнорируются); настоящая математическая эквивалентность — отдельный
    # detereministic-checker в AI-конвейере, не эта проверка.
    ANSWER_TYPES = ("single_answer", "multiple_choice")

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True, nullable=False)
    description = Column(String, nullable=True)
    subject = Column(String, nullable=False)  # Оставляем для обратной совместимости
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=True)  # Новое поле
    skill_id = Column(Integer, ForeignKey("skills.id"), nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Связи
    owner = relationship("User", back_populates="tasks")
    subject_ref = relationship("Subject", back_populates="tasks")
    skill = relationship("Skill")
    created_by_admin = relationship("Admin", foreign_keys="Task.created_by_admin_id")
    approved_by_admin = relationship("Admin", foreign_keys="Task.approved_by_admin_id")
    task_group_id = Column(Integer, ForeignKey("task_groups.id"), nullable=True)
    reward_points = Column(Integer, default=5)
    # Числовая сложность для игровых механик (напр. DerivFall) — самостоятельная
    # шкала, НЕ то же самое, что content-level ниже; не путать и не сливать.
    difficulty_level = Column(Integer, default=1)
    estimated_time_seconds = Column(Integer, default=60)

    # Контентная модель (R1): уровень темы, статус публикации, версия и
    # источник. Дефолты — Python-side (в отличие от Admin.role): здесь
    # неявный дефолт безопасен, это метаданные рабочего процесса, а не права.
    level = Column(String, nullable=False, default="standard")
    status = Column(String, nullable=False, default="draft")
    version = Column(Integer, nullable=False, default=1)
    source = Column(String, nullable=False, default="manual")
    created_by_admin_id = Column(Integer, ForeignKey("admins.id"), nullable=True)
    approved_by_admin_id = Column(Integer, ForeignKey("admins.id"), nullable=True)
    published_at = Column(DateTime, nullable=True)
    archived_at = Column(DateTime, nullable=True)

    # Само содержимое вопроса (R2 task 1 prerequisite) — до этого в Task не
    # было ничего для реальной проверки ответа ученика, хотя student-facing
    # TaskSolver.tsx уже ожидал ровно эти поля (content/options/answer_type).
    # correct_answer НИКОГДА не должен попадать в student-facing ответ
    # (см. app/routes/gamification.py) — только в admin-эндпоинты.
    content = Column(String, nullable=True)
    answer_type = Column(String, nullable=False, default="single_answer")
    options = Column(JSON, nullable=True)  # только для multiple_choice
    correct_answer = Column(String, nullable=True)  # multiple_choice: индекс варианта строкой


class Attempt(Base):
    """
    R2 task 1: центральная таблица попыток — от неё зависят диагностика и
    mastery_state. content_type/content_id — generic-ссылка (сейчас только
    "task", в R3 добавится "game" на ту же таблицу), не строгий FK, т.к.
    content_type определяет, на какую таблицу смотрит content_id. source
    разделяет обычные попытки от игровых — при пересчёте mastery игровые
    учитываются только агрегированно, не 1:1 с обычной попыткой (см.
    docs/roadmap/product-technical-plan.md, R2 §2).
    """
    __tablename__ = "attempts"

    CONTENT_TYPES = ("task", "diagnostic", "game")
    SOURCES = ("manual", "game")

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content_type = Column(String, nullable=False, default="task")
    content_id = Column(Integer, nullable=False)
    skill_id = Column(Integer, ForeignKey("skills.id"), nullable=True)
    is_correct = Column(Boolean, nullable=False)
    time_spent_ms = Column(Integer, nullable=True)
    hints_used = Column(Integer, nullable=False, default=0)
    source = Column(String, nullable=False, default="manual")
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")
    skill = relationship("Skill")


class MasteryState(Base):
    """
    R2 task 2: один пересчитанный уровень освоения на (user, skill). Пишется
    сервисом app/services/mastery.py — не вручную из роутов. factors хранит
    сырые сигналы (accuracy/avg_time_ratio/hints_rate), из которых считается
    level — это и есть "причина рекомендации", которую увидит ученик (R2
    task 4 строит UI поверх этого поля, здесь только данные).
    """
    __tablename__ = "mastery_state"
    __table_args__ = (
        UniqueConstraint("user_id", "skill_id", name="uq_mastery_state_user_id_skill_id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    skill_id = Column(Integer, ForeignKey("skills.id"), nullable=False)
    level = Column(String, nullable=False)
    confidence = Column(Integer, nullable=False, default=0)  # 0..100, см. app/services/mastery.py
    sample_size = Column(Integer, nullable=False, default=0)
    factors = Column(JSON, nullable=True)
    window_from = Column(DateTime, nullable=True)
    window_to = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User")
    skill = relationship("Skill")


class Diagnostic(Base):
    """
    R2 task 3: куратор собирает набор УЖЕ опубликованных заданий темы в один
    диагностический тест — не отдельный тип контента, ревью на самих
    заданиях уже пройдено. task_ids — JSON-список id (не M2M-таблица: набор
    маленький, порядок важен, отдельная таблица связи была бы overkill).
    is_active вместо статус-workflow — как у Subject/Skill, без draft/review
    (эта простота отличает Diagnostic от Task, тут разница осознанная).
    """
    __tablename__ = "diagnostics"

    id = Column(Integer, primary_key=True, index=True)
    skill_id = Column(Integer, ForeignKey("skills.id"), nullable=False)
    task_ids = Column(JSON, nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_by_admin_id = Column(Integer, ForeignKey("admins.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    skill = relationship("Skill")


class LevelOverride(Base):
    """
    R2 task 4: ученик временно выбирает СОСЕДНИЙ (не любой) уровень
    относительно computed mastery_state.level — проверка соседства и срок
    действия считаются в app/services/mastery.py, не здесь. Один активный
    override на (user, skill) — новый вызов апсертит старый, а не плодит
    историю (история переходов тут не нужна, в отличие от Task/ContentStatusHistory).
    """
    __tablename__ = "level_overrides"
    __table_args__ = (
        UniqueConstraint("user_id", "skill_id", name="uq_level_overrides_user_id_skill_id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    skill_id = Column(Integer, ForeignKey("skills.id"), nullable=False)
    chosen_level = Column(String, nullable=False)
    reason = Column(String, nullable=False, default="manual")
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")
    skill = relationship("Skill")


class PromptTemplate(Base):
    """
    R2 task 5: именованный шаблон промпта для AI-заказов. version — по
    названию + версии можно проследить, каким именно шаблоном сгенерирован
    конкретный AIGenerationItem (см. requested_by/prompt_template_id ниже) —
    требование "хранить... prompt template, версию модели" из решений.
    """
    __tablename__ = "prompt_templates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    version = Column(Integer, nullable=False, default=1)
    template_text = Column(String, nullable=False)
    task_type = Column(String, nullable=False)  # single_answer | multiple_choice
    created_at = Column(DateTime, default=datetime.utcnow)


class AIGenerationOrder(Base):
    """
    R2 task 5: пакетный заказ на AI-генерацию. Выбор провайдера не принят
    (decision gate, см. docs/roadmap/product-technical-plan.md R2 §7) —
    model_version здесь всегда указывает на MockAIProvider
    (app/services/ai_provider.py), пока решение не закрыто. Обработка
    заказа — синхронная (см. app/services/ai_pipeline.py); очереди задач
    в проекте нет, при реальном провайдере и больших count это надо будет
    вынести в фон — сознательно не делаю этого сейчас.
    """
    __tablename__ = "ai_generation_orders"

    STATUSES = ("queued", "processing", "completed", "failed")

    id = Column(Integer, primary_key=True, index=True)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    skill_id = Column(Integer, ForeignKey("skills.id"), nullable=False)
    level = Column(String, nullable=False, default="standard")
    task_type = Column(String, nullable=False)  # single_answer | multiple_choice
    count = Column(Integer, nullable=False)
    constraints = Column(JSON, nullable=True)
    prompt_template_id = Column(Integer, ForeignKey("prompt_templates.id"), nullable=False)
    model_version = Column(String, nullable=False, default="mock-v1")
    requested_by_admin_id = Column(Integer, ForeignKey("admins.id"), nullable=True)
    status = Column(String, nullable=False, default="queued")
    created_at = Column(DateTime, default=datetime.utcnow)

    subject = relationship("Subject")
    skill = relationship("Skill")
    prompt_template = relationship("PromptTemplate")
    requested_by = relationship("Admin")
    items = relationship("AIGenerationItem", back_populates="order", order_by="AIGenerationItem.index_in_order")


class AIGenerationItem(Base):
    """
    Одно сгенерированное задание внутри заказа — трассировка по каждой
    стадии конвейера отдельно (validation/sanitization/deterministic
    check/critic), не одним булевым "прошло/не прошло". task_id
    заполняется, ТОЛЬКО когда все автоматические стадии пройдены и создан
    черновик Task(source="ai", status="draft") — дальше этот Task живёт по
    ОБЫЧНОМУ R1 workflow (submit_review/approve/publish), отдельного
    "review UI" для AI не строится, это и есть "используются наравне
    с ручными" из решений. AI НИКОГДА не публикует сам — до draft доводит
    только автоматика, дальше только человек.
    """
    __tablename__ = "ai_generation_items"

    STATUSES = ("pending", "ready", "failed_generation", "failed_validation", "failed_answer_check")

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("ai_generation_orders.id"), nullable=False)
    index_in_order = Column(Integer, nullable=False)
    status = Column(String, nullable=False, default="pending")
    failure_reason = Column(String, nullable=True)
    draft_json = Column(JSON, nullable=True)
    validation_result = Column(JSON, nullable=True)
    sanitization_result = Column(JSON, nullable=True)
    deterministic_check_result = Column(JSON, nullable=True)
    ai_critic_result = Column(JSON, nullable=True)
    # ondelete=SET NULL (R4): жёсткое удаление задания не должно ронять
    # удаление ошибкой FK — история AI-генерации (draft/validation/critic)
    # ценна сама по себе и переживает удаление итогового Task.
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    order = relationship("AIGenerationOrder", back_populates="items")
    task = relationship("Task")


class AIQuota(Base):
    """
    R2 task 6: месячная квота на AI-генерацию, одна строка на админа.
    period — "YYYY-MM" текущего отслеживаемого месяца; при обращении в
    новом месяце app/services/ai_quota.py сам сбрасывает used и сдвигает
    period, отдельного cron/job для сброса нет. Списывается по количеству
    ЗАПРОШЕННЫХ item'ов заказа (order.count), а не по успешно
    сгенерированным — вызов провайдера произошёл независимо от того, прошёл
    ли черновик валидацию (см. app/services/ai_pipeline.py).
    """
    __tablename__ = "ai_quotas"

    id = Column(Integer, primary_key=True, index=True)
    admin_id = Column(Integer, ForeignKey("admins.id"), nullable=False, unique=True)
    period = Column(String, nullable=False)
    monthly_limit = Column(Integer, nullable=False)
    used = Column(Integer, nullable=False, default=0)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    admin = relationship("Admin")


class AuditLog(Base):
    """
    Пишется автоматически мидлварью audit_logging в main.py для КАЖДОГО
    мутирующего запроса под /admin (POST/PUT/PATCH/DELETE), успешного или
    нет — покрытие не зависит от того, вспомнил ли автор нового эндпоинта
    вызвать логирование вручную. entity_type/entity_id/action — best-effort
    разбор пути (/admin/tasks/42/publish -> tasks/42/publish), не путать с
    полноценной семантической классификацией.
    """
    __tablename__ = "audit_log"

    id = Column(Integer, primary_key=True, index=True)
    actor_admin_id = Column(Integer, ForeignKey("admins.id"), nullable=True)
    actor_role = Column(String, nullable=True)
    method = Column(String, nullable=False)
    path = Column(String, nullable=False)
    entity_type = Column(String, nullable=True)
    entity_id = Column(String, nullable=True)
    action = Column(String, nullable=True)
    status_code = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    actor_admin = relationship("Admin")


class ContentStatusHistory(Base):
    __tablename__ = "content_status_history"

    id = Column(Integer, primary_key=True, index=True)
    # ondelete=CASCADE (R4): история переходов статуса не имеет смысла без
    # самого задания — раньше DELETE /admin/tasks/{id} падал 500 (FK
    # violation) для любого задания, прошедшего хоть один переход статуса.
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    from_status = Column(String, nullable=True)
    to_status = Column(String, nullable=False)
    actor_admin_id = Column(Integer, ForeignKey("admins.id"), nullable=True)
    comment = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    task = relationship("Task")
    actor_admin = relationship("Admin")


class GameScenario(Base):
    """
    R3 task 2: сценарий игрового шаблона, настраиваемый content_manager'ом
    без кода. config хранит провалидированный (см. app/services/game_config.py)
    template-специфичный конфиг — форма зависит от template_key. В отличие
    от Task — только draft/published/archived, без four-eyes ревью: чек-лист
    (game_scenario_checklist) и preview-гейт ниже заменяют собой approve.
    updated_at нужен для staleness-проверки на публикации: чек-лист/preview,
    пройденные ДО последнего редактирования конфига, публикацию не
    разблокируют — иначе можно отредактировать текст после чек-листа и
    опубликовать непроверенное.
    """
    __tablename__ = "game_scenarios"

    TEMPLATE_KEYS = ("derivfall", "integralbuilder", "mathlab")
    STATUSES = ("draft", "published", "archived")

    id = Column(Integer, primary_key=True, index=True)
    template_key = Column(String, nullable=False)
    config = Column(JSON, nullable=False)
    status = Column(String, nullable=False, default="draft")
    level_range = Column(JSON, nullable=True)  # [min, max], 1..5 — та же шкала, что difficulty-проп у всех трёх шаблонов
    availability_from = Column(DateTime, nullable=True)
    availability_to = Column(DateTime, nullable=True)
    # R3 task 6: nullable "на первое время", как и Task.skill_id в R1 — без
    # темы попытка всё равно пишется в attempts (аналитика/дашборд), но
    # mastery_service нечего пересчитывать (см. app/services/game_attempts.py).
    skill_id = Column(Integer, ForeignKey("skills.id"), nullable=True)
    created_by_admin_id = Column(Integer, ForeignKey("admins.id"), nullable=True)
    preview_passed_at = Column(DateTime, nullable=True)
    published_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    # Без onupdate: должен двигаться ТОЛЬКО когда реально меняется config
    # (см. update_scenario в app/routes/game_scenarios.py), а не при любом
    # сохранении строки — иначе preview/checklist сами себя делают
    # "устаревшими" сразу после прохождения (onupdate сработал бы и на них).
    updated_at = Column(DateTime, nullable=True)

    created_by_admin = relationship("Admin")
    skill = relationship("Skill")


class GameScenarioChecklistItem(Base):
    """
    R3 task 2: фиксация ручного контентного чек-листа перед публикацией
    (аудируемо — см. docs/roadmap/product-technical-plan.md R3 §3). Строка
    существует = пункт отмечен; checked_at сверяется с
    GameScenario.updated_at на публикации (см. комментарий там же).
    """
    __tablename__ = "game_scenario_checklist"
    __table_args__ = (
        UniqueConstraint("scenario_id", "item_key", name="uq_game_scenario_checklist_scenario_item"),
    )

    ITEM_KEYS = ("texts_correct", "no_placeholders", "katex_renders")

    id = Column(Integer, primary_key=True, index=True)
    scenario_id = Column(Integer, ForeignKey("game_scenarios.id"), nullable=False)
    item_key = Column(String, nullable=False)
    checked_by_admin_id = Column(Integer, ForeignKey("admins.id"), nullable=True)
    checked_at = Column(DateTime, default=datetime.utcnow)

    scenario = relationship("GameScenario")
    checked_by_admin = relationship("Admin")


class ContentFlag(Base):
    """
    R2 task 7: пост-публикационный мониторинг. anomaly — создаётся системой
    (app/services/content_quality.py) по агрегатам attempts опубликованного
    AI-задания и автоматически возвращает Task в in_review — единственный
    случай, когда статус контента меняет не человек, а система. complaint —
    жалоба staff после публикации; сама по себе статус НЕ меняет (см.
    docs/roadmap/product-technical-plan.md, R2 §7: "жалоба... статус меняет
    только человек") — только видна на экране "аналитика качества", решение
    принимает reviewer вручную (return_to_review/archive).
    """
    __tablename__ = "content_flags"

    FLAG_TYPES = ("anomaly", "complaint")
    STATUSES = ("open", "resolved", "dismissed")

    id = Column(Integer, primary_key=True, index=True)
    # ondelete=CASCADE (R4) — та же причина, что у ContentStatusHistory
    # выше: жалоба/аномалия на удалённое задание бессмысленна сама по себе.
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    flag_type = Column(String, nullable=False)
    details = Column(JSON, nullable=True)
    status = Column(String, nullable=False, default="open")
    created_by_admin_id = Column(Integer, ForeignKey("admins.id"), nullable=True)
    resolved_by_admin_id = Column(Integer, ForeignKey("admins.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)

    task = relationship("Task")


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
    skills = relationship("Skill", back_populates="subject")


# Тема внутри раздела — единица, по которой считается уровень освоения
# (базовый/стандартный/продвинутый). См. .claude/skills/secure-coding для
# связанных требований и docs/roadmap/product-technical-plan.md (R1, §1.2).
class Skill(Base):
    __tablename__ = "skills"
    __table_args__ = (
        UniqueConstraint("subject_id", "code", name="uq_skills_subject_id_code"),
    )

    id = Column(Integer, primary_key=True, index=True)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    name = Column(String, nullable=False)
    code = Column(String, nullable=False)
    order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    subject = relationship("Subject", back_populates="skills")
