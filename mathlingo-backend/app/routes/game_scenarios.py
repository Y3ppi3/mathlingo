# app/routes/game_scenarios.py
"""
R3 task 2: CRUD игровых сценариев + чек-лист + preview-гейт публикации (см.
docs/roadmap/product-technical-plan.md, R3 §3, §5). Сам конструктор
(форма + live-предпросмотр от лица ученика в UI) — R3 задача 5; здесь —
backend-контракт, на который он будет опираться.

Студенческие эндпоинты активного сценария и попытки игры (R3 задачи 3, 6)
переехали сюда из gamification.py при разбиении по доменам (R4) — тот же
домен (GameScenario), что и admin-CRUD выше, только другой префикс и роли,
поэтому отдельный router (student_router) в этом же файле.
"""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database import get_db
from app.models import Admin, GameScenario, GameScenarioChecklistItem, Skill, User
from app.schemas import (
    ActiveGameScenarioResponse, GameAttemptSubmissionRequest, GameAttemptSubmissionResponse,
    GameScenarioChecklistItemResponse, GameScenarioCreate, GameScenarioResponse, GameScenarioUpdate,
)
from app.auth import get_admin_current_user, get_current_user, require_role
from app.services import cache, game_attempts, game_config

router = APIRouter(prefix="/admin/game-scenarios", tags=["game_scenarios"])
student_router = APIRouter(prefix="/gamification/game-scenarios", tags=["game_scenarios"])

# R4: GET /gamification/game-scenarios/active/{template_key} дёргается на
# каждый старт каждой игры каждым учеником — самый горячий student-facing
# эндпоинт, при этом меняется редко (только publish/archive/update того же
# template_key). TTL — подстраховка на случай пропущенной инвалидации, не
# основной механизм актуальности.
ACTIVE_SCENARIO_CACHE_PREFIX = "game_scenario_active"
ACTIVE_SCENARIO_CACHE_TTL = 300


def _active_scenario_cache_key(template_key: str, mode: Optional[str]) -> str:
    return f"{ACTIVE_SCENARIO_CACHE_PREFIX}:{template_key}:{mode or '_'}"


def _invalidate_active_scenario_cache(template_key: str) -> None:
    cache.delete_prefix(f"{ACTIVE_SCENARIO_CACHE_PREFIX}:{template_key}:")

# Создание/редактирование/публикация/архивация сценария — superadmin и
# content_manager (симметрично CAN_MANAGE_CONTENT в admin.py). Просмотр,
# предпросмотр и прохождение чек-листа — плюс teacher (см. R3 §5: teacher
# может отмечать пункты чек-листа, но не публиковать).
CAN_MANAGE_SCENARIOS = require_role("superadmin", "content_manager")
CAN_ACCESS_SCENARIOS = require_role("superadmin", "content_manager", "teacher")


def _get_scenario_or_404(db: Session, scenario_id: int) -> GameScenario:
    scenario = db.query(GameScenario).filter(GameScenario.id == scenario_id).first()
    if not scenario:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Сценарий не найден")
    return scenario


def _validate_skill_exists(db: Session, skill_id: Optional[int]) -> None:
    # skill_id нужен для mastery_service (см. app/services/game_attempts.py,
    # R3 task 6) — без темы попытки в этом сценарии не будут влиять на
    # mastery_state, но сам сценарий валиден и без неё (nullable, как и
    # Task.skill_id в R1 "на первое время").
    if skill_id is None:
        return
    if not db.query(Skill).filter(Skill.id == skill_id).first():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Тема (skill) не найдена")


@router.post("/", response_model=GameScenarioResponse)
def create_scenario(
        body: GameScenarioCreate,
        db: Session = Depends(get_db),
        current_admin: Admin = Depends(CAN_MANAGE_SCENARIOS),
):
    try:
        validated_config = game_config.validate_config(body.template_key, body.config)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))

    _validate_skill_exists(db, body.skill_id)

    scenario = GameScenario(
        template_key=body.template_key,
        config=validated_config,
        status="draft",
        skill_id=body.skill_id,
        level_range=body.level_range,
        availability_from=body.availability_from,
        availability_to=body.availability_to,
        created_by_admin_id=current_admin.id,
    )
    db.add(scenario)
    db.commit()
    db.refresh(scenario)
    return scenario


@router.get("/", response_model=List[GameScenarioResponse])
def list_scenarios(
        status_filter: Optional[str] = None,
        template_key: Optional[str] = None,
        db: Session = Depends(get_db),
        current_admin: Admin = Depends(CAN_ACCESS_SCENARIOS),
):
    query = db.query(GameScenario)
    if status_filter:
        query = query.filter(GameScenario.status == status_filter)
    if template_key:
        query = query.filter(GameScenario.template_key == template_key)
    return query.order_by(GameScenario.created_at.desc()).all()


@router.get("/{scenario_id}", response_model=GameScenarioResponse)
def get_scenario(
        scenario_id: int,
        db: Session = Depends(get_db),
        current_admin: Admin = Depends(CAN_ACCESS_SCENARIOS),
):
    return _get_scenario_or_404(db, scenario_id)


@router.put("/{scenario_id}", response_model=GameScenarioResponse)
def update_scenario(
        scenario_id: int,
        body: GameScenarioUpdate,
        db: Session = Depends(get_db),
        current_admin: Admin = Depends(CAN_MANAGE_SCENARIOS),
):
    scenario = _get_scenario_or_404(db, scenario_id)
    if scenario.status != "draft":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Редактировать можно только черновик — опубликованный сценарий сначала архивируйте",
        )

    if body.config is not None:
        try:
            scenario.config = game_config.validate_config(scenario.template_key, body.config)
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
        # Правка конфига обесценивает уже пройденный preview — чек-лист не
        # трогаем (строки остаются для аудита), staleness проверяется по
        # updated_at на публикации (см. _check_publish_gate). updated_at
        # двигаем ТОЛЬКО здесь, когда меняется именно config — level_range/
        # availability не влияют на чек-лист/preview, поэтому их правка ниже
        # updated_at не трогает.
        scenario.preview_passed_at = None
        scenario.updated_at = datetime.utcnow()

    if body.skill_id is not None:
        _validate_skill_exists(db, body.skill_id)
        scenario.skill_id = body.skill_id
    if body.level_range is not None:
        scenario.level_range = body.level_range
    if body.availability_from is not None:
        scenario.availability_from = body.availability_from
    if body.availability_to is not None:
        scenario.availability_to = body.availability_to

    db.commit()
    db.refresh(scenario)
    return scenario


@router.get("/{scenario_id}/checklist", response_model=List[GameScenarioChecklistItemResponse])
def get_checklist(
        scenario_id: int,
        db: Session = Depends(get_db),
        current_admin: Admin = Depends(CAN_ACCESS_SCENARIOS),
):
    scenario = _get_scenario_or_404(db, scenario_id)
    checked = {
        item.item_key: item
        for item in db.query(GameScenarioChecklistItem).filter(GameScenarioChecklistItem.scenario_id == scenario.id)
    }
    return [
        GameScenarioChecklistItemResponse(
            item_key=key,
            checked_by_admin_id=checked[key].checked_by_admin_id if key in checked else None,
            checked_at=checked[key].checked_at if key in checked else None,
        )
        for key in GameScenarioChecklistItem.ITEM_KEYS
    ]


@router.post("/{scenario_id}/checklist/{item_key}", response_model=GameScenarioChecklistItemResponse)
def check_checklist_item(
        scenario_id: int,
        item_key: str,
        db: Session = Depends(get_db),
        current_admin: Admin = Depends(CAN_ACCESS_SCENARIOS),
):
    scenario = _get_scenario_or_404(db, scenario_id)
    if item_key not in GameScenarioChecklistItem.ITEM_KEYS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Неизвестный пункт чек-листа: {item_key}")

    item = (
        db.query(GameScenarioChecklistItem)
        .filter(GameScenarioChecklistItem.scenario_id == scenario.id, GameScenarioChecklistItem.item_key == item_key)
        .first()
    )
    if not item:
        item = GameScenarioChecklistItem(scenario_id=scenario.id, item_key=item_key)
        db.add(item)

    item.checked_by_admin_id = current_admin.id
    item.checked_at = datetime.utcnow()
    db.commit()
    db.refresh(item)
    return item


@router.post("/{scenario_id}/preview", response_model=GameScenarioResponse)
def preview_scenario(
        scenario_id: int,
        db: Session = Depends(get_db),
        current_admin: Admin = Depends(CAN_ACCESS_SCENARIOS),
):
    """
    Валидирует текущий config схемой шаблона и, если он всё ещё валиден,
    фиксирует момент успешного прогона — это и есть preview-гейт публикации
    из плана. Сам рендер "от лица ученика" — задача конструктора (R3 task 5)
    на фронтенде; здесь только backend-подтверждение, что конфиг рабочий.
    """
    scenario = _get_scenario_or_404(db, scenario_id)
    try:
        game_config.validate_config(scenario.template_key, scenario.config)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))

    scenario.preview_passed_at = datetime.utcnow()
    db.commit()
    db.refresh(scenario)
    return scenario


def _check_publish_gate(db: Session, scenario: GameScenario) -> None:
    if scenario.status != "draft":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Публикация недоступна из статуса '{scenario.status}'",
        )

    baseline = scenario.updated_at or scenario.created_at

    if scenario.preview_passed_at is None or scenario.preview_passed_at < baseline:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Нужен свежий успешный предпросмотр после последнего изменения конфига",
        )

    checked_items = {
        item.item_key: item
        for item in db.query(GameScenarioChecklistItem).filter(GameScenarioChecklistItem.scenario_id == scenario.id)
    }
    missing_or_stale = [
        key for key in GameScenarioChecklistItem.ITEM_KEYS
        if key not in checked_items or checked_items[key].checked_at < baseline
    ]
    if missing_or_stale:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Чек-лист не пройден полностью (после последнего изменения): {', '.join(missing_or_stale)}",
        )


@router.post("/{scenario_id}/publish", response_model=GameScenarioResponse)
def publish_scenario(
        scenario_id: int,
        db: Session = Depends(get_db),
        current_admin: Admin = Depends(CAN_MANAGE_SCENARIOS),
):
    scenario = _get_scenario_or_404(db, scenario_id)
    _check_publish_gate(db, scenario)

    scenario.status = "published"
    scenario.published_at = datetime.utcnow()
    db.commit()
    db.refresh(scenario)
    _invalidate_active_scenario_cache(scenario.template_key)
    return scenario


@router.post("/{scenario_id}/archive", response_model=GameScenarioResponse)
def archive_scenario(
        scenario_id: int,
        db: Session = Depends(get_db),
        current_admin: Admin = Depends(CAN_MANAGE_SCENARIOS),
):
    scenario = _get_scenario_or_404(db, scenario_id)
    if scenario.status == "archived":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Сценарий уже в архиве")

    scenario.status = "archived"
    db.commit()
    db.refresh(scenario)
    _invalidate_active_scenario_cache(scenario.template_key)
    return scenario


# --- Студенческие эндпоинты (см. docstring модуля) ---

@student_router.get("/active/{template_key}", response_model=ActiveGameScenarioResponse)
def get_active_game_scenario(
        template_key: str,
        mode: Optional[str] = None,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user),
):
    """
    R3 task 3/4: единственная точка, откуда игровые компоненты берут конфиг —
    DerivFall/IntegralBuilder/MathLab больше не хранят задания в коде, а
    запрашивают текущий опубликованный сценарий шаблона здесь. Если
    опубликованных сценариев несколько (после задачи 5, когда появится
    конструктор) — берём самый свежий по published_at; выбор "какой именно
    сценарий подходит ученику" (level_range/группы) — вне scope этой задачи,
    минимально жизнеспособная выборка.

    `mode` — только для mathlab: derivatives/integrals делят один
    template_key, но это разные опубликованные сценарии (см.
    MathLabConfig.mode), поэтому фильтруем по config->mode в Python, а не
    в SQL — набор опубликованных сценариев одного шаблона мал, а
    JSON-фильтрация в SQL отличалась бы между SQLite (тесты) и Postgres
    (dev/prod) без practической пользы.
    """
    if template_key not in GameScenario.TEMPLATE_KEYS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Неизвестный template_key: {template_key}")

    cache_key = _active_scenario_cache_key(template_key, mode)
    cached = cache.get_json(cache_key)
    if cached is not None:
        return cached

    now = datetime.utcnow()
    scenarios = (
        db.query(GameScenario)
        .filter(
            GameScenario.template_key == template_key,
            GameScenario.status == "published",
            (GameScenario.availability_from == None) | (GameScenario.availability_from <= now),
            (GameScenario.availability_to == None) | (GameScenario.availability_to >= now),
        )
        .order_by(GameScenario.published_at.desc())
        .all()
    )
    if mode is not None:
        scenarios = [s for s in scenarios if s.config.get("mode") == mode]

    if not scenarios:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Для этого шаблона нет доступного опубликованного сценария")

    result = ActiveGameScenarioResponse.model_validate(scenarios[0], from_attributes=True)
    result_dict = result.model_dump(mode="json")
    cache.set_json(cache_key, result_dict, ttl=ACTIVE_SCENARIO_CACHE_TTL)
    return result_dict


def _is_scenario_active(scenario: GameScenario, now: datetime) -> bool:
    if scenario.status != "published":
        return False
    if scenario.availability_from is not None and scenario.availability_from > now:
        return False
    if scenario.availability_to is not None and scenario.availability_to < now:
        return False
    return True


@student_router.post("/{scenario_id}/submit-attempt", response_model=GameAttemptSubmissionResponse)
def submit_game_attempt(
        scenario_id: int,
        body: GameAttemptSubmissionRequest,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user),
):
    """
    R3 task 6: игра пишет ОДНУ попытку на всю сессию (score/max_score), а не
    на каждый внутриигровой ответ — см. app/services/game_attempts.py.
    Дополнительно валидирует, что content_id — активный (опубликованный и в
    окне доступности) game_scenario, как того требует план (R3 §3).
    """
    scenario = db.query(GameScenario).filter(GameScenario.id == scenario_id).first()
    if not scenario:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Сценарий не найден")
    if not _is_scenario_active(scenario, datetime.utcnow()):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Сценарий недоступен для игры")

    attempt = game_attempts.record_attempt(
        db, current_user.id, scenario,
        score=body.score, max_score=body.max_score, time_spent_ms=body.time_spent_ms,
    )
    return GameAttemptSubmissionResponse(is_correct=attempt.is_correct)
