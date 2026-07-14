# app/routes/gamification_mastery.py
"""
Освоение темы: текущее mastery_state, рекомендованный уровень "с причиной"
и временный override (R2 задачи 2, 4) — выделено из gamification.py при
разбиении по доменам (R4), см. docs/roadmap/product-technical-plan.md.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import MasteryState, User
from app.auth import get_current_user
from app.services import mastery
from app.schemas import (
    MasteryStateResponse,
    SkillLevelResponse,
    LevelOverrideRequest,
)

router = APIRouter(prefix="/gamification", tags=["gamification"])


@router.get("/skills/{skill_id}/mastery", response_model=MasteryStateResponse)
def get_skill_mastery(
        skill_id: int,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user),
):
    """
    Текущее mastery_state ученика по теме — только для себя (current_user),
    не по чужому user_id. Полноценный UI "почему такая рекомендация" и
    временный выбор соседнего уровня — R2 task 4, здесь только данные.
    """
    state = (
        db.query(MasteryState)
        .filter(MasteryState.user_id == current_user.id, MasteryState.skill_id == skill_id)
        .first()
    )
    if not state:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ещё нет данных по этой теме — нужна хотя бы одна попытка",
        )
    return state


# --- Рекомендация уровня "с причиной" + временный выбор соседнего (R2 task 4) ---

@router.get("/skills/{skill_id}/level", response_model=SkillLevelResponse)
def get_skill_level(
        skill_id: int,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user),
):
    """
    В отличие от /mastery — всегда 200, даже без единой попытки (nullable
    поля), потому что это основной эндпоинт для экрана "твой уровень",
    который должен показать осмысленное "пока нет данных", а не ошибку.
    """
    state = (
        db.query(MasteryState)
        .filter(MasteryState.user_id == current_user.id, MasteryState.skill_id == skill_id)
        .first()
    )
    override = mastery.get_active_override(db, current_user.id, skill_id)

    computed_level = state.level if state else None
    effective_level = override.chosen_level if override else computed_level

    return SkillLevelResponse(
        skill_id=skill_id,
        computed_level=computed_level,
        confidence=state.confidence if state else 0,
        sample_size=state.sample_size if state else 0,
        factors=state.factors if state else None,
        override=override,
        effective_level=effective_level,
    )


@router.post("/skills/{skill_id}/level-override", response_model=SkillLevelResponse)
def set_skill_level_override(
        skill_id: int,
        body: LevelOverrideRequest,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user),
):
    try:
        mastery.set_override(db, current_user.id, skill_id, body.chosen_level)
    except ValueError as e:
        if str(e) == "no_mastery_state":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Нужна хотя бы одна попытка или диагностика, прежде чем выбирать уровень вручную",
            )
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Можно выбрать только соседний уровень относительно рекомендованного",
        )
    return get_skill_level(skill_id, db, current_user)


@router.delete("/skills/{skill_id}/level-override", response_model=SkillLevelResponse)
def clear_skill_level_override(
        skill_id: int,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user),
):
    mastery.clear_override(db, current_user.id, skill_id)
    return get_skill_level(skill_id, db, current_user)
