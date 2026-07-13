from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database import get_db
from app.models import Admin, Skill, Subject
from app.schemas import SkillCreate, SkillResponse, SkillUpdate
from app.auth import get_admin_current_user, require_role

router = APIRouter(prefix="/admin/skills", tags=["skills"])

# Чтение — любой авторизованный staff (superadmin/content_manager/teacher
# должны видеть темы: teacher — при проверке черновиков, остальные — при
# создании контента). Мутации — только superadmin/content_manager, см.
# docs/roadmap/product-technical-plan.md (R1, §5).
CAN_MANAGE = require_role("superadmin", "content_manager")


@router.get("/", response_model=List[SkillResponse])
def get_skills(
    subject_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_admin_current_user),
):
    query = db.query(Skill)
    if subject_id is not None:
        query = query.filter(Skill.subject_id == subject_id)
    return query.order_by(Skill.order, Skill.id).offset(skip).limit(limit).all()


@router.get("/{skill_id}", response_model=SkillResponse)
def get_skill(
    skill_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_admin_current_user),
):
    skill = db.query(Skill).filter(Skill.id == skill_id).first()
    if not skill:
        raise HTTPException(status_code=404, detail="Тема не найдена")
    return skill


@router.post("/", response_model=SkillResponse)
def create_skill(
    skill: SkillCreate,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(CAN_MANAGE),
):
    subject = db.query(Subject).filter(Subject.id == skill.subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Раздел не найден")

    existing = db.query(Skill).filter(
        Skill.subject_id == skill.subject_id, Skill.code == skill.code
    ).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Тема с кодом '{skill.code}' уже существует в этом разделе",
        )

    db_skill = Skill(**skill.dict())
    db.add(db_skill)
    db.commit()
    db.refresh(db_skill)
    return db_skill


@router.put("/{skill_id}", response_model=SkillResponse)
def update_skill(
    skill_id: int,
    skill_update: SkillUpdate,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(CAN_MANAGE),
):
    db_skill = db.query(Skill).filter(Skill.id == skill_id).first()
    if not db_skill:
        raise HTTPException(status_code=404, detail="Тема не найдена")

    update_data = skill_update.dict(exclude_unset=True)
    if "code" in update_data and update_data["code"] != db_skill.code:
        existing = db.query(Skill).filter(
            Skill.subject_id == db_skill.subject_id,
            Skill.code == update_data["code"],
        ).first()
        if existing:
            raise HTTPException(
                status_code=400,
                detail=f"Тема с кодом '{update_data['code']}' уже существует в этом разделе",
            )

    for key, value in update_data.items():
        setattr(db_skill, key, value)

    db.commit()
    db.refresh(db_skill)
    return db_skill
