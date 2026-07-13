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
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False)
    from_status = Column(String, nullable=True)
    to_status = Column(String, nullable=False)
    actor_admin_id = Column(Integer, ForeignKey("admins.id"), nullable=True)
    comment = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    task = relationship("Task")
    actor_admin = relationship("Admin")


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
