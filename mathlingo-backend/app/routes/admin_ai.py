# app/routes/admin_ai.py
"""
AI-конвейер: промпт-шаблоны, заказы генерации, квоты (R2 задачи 5-6) —
выделено из admin.py при разбиении по доменам (R4), см.
docs/roadmap/product-technical-plan.md.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database import get_db
from app.models import Admin, AIGenerationOrder, AIQuota, PromptTemplate, Skill, Subject
from app.schemas import (
    AIGenerationOrderCreate, AIGenerationOrderDetailResponse, AIGenerationOrderResponse,
    AIQuotaResponse, AIQuotaUpdateRequest, PromptTemplateCreate, PromptTemplateResponse,
)
from app.auth import require_role
from app.services import ai_pipeline, ai_quota
from app.routes._admin_rbac import CAN_MANAGE_CONTENT

router = APIRouter(prefix="/admin", tags=["admin_ai"])

# Запуск доступен только superadmin/content_manager (см. решения). Квоты —
# отдельная задача 6, здесь только жёсткий верхний предел на count, чтобы
# один синхронный запрос не мог запросить произвольно много генераций —
# в проекте нет очереди фоновых задач, весь заказ обрабатывается in-request.
MAX_ORDER_COUNT = 20


@router.post("/ai/prompt-templates", response_model=PromptTemplateResponse)
def create_prompt_template(
        body: PromptTemplateCreate,
        db: Session = Depends(get_db),
        current_admin: Admin = Depends(CAN_MANAGE_CONTENT),
):
    template = PromptTemplate(**body.dict())
    db.add(template)
    db.commit()
    db.refresh(template)
    return template


@router.get("/ai/prompt-templates", response_model=List[PromptTemplateResponse])
def list_prompt_templates(
        db: Session = Depends(get_db),
        current_admin: Admin = Depends(CAN_MANAGE_CONTENT),
):
    return db.query(PromptTemplate).order_by(PromptTemplate.id.desc()).all()


@router.post("/ai/orders", response_model=AIGenerationOrderDetailResponse)
def create_ai_order(
        body: AIGenerationOrderCreate,
        db: Session = Depends(get_db),
        current_admin: Admin = Depends(CAN_MANAGE_CONTENT),
):
    if not (1 <= body.count <= MAX_ORDER_COUNT):
        raise HTTPException(status_code=400, detail=f"count должен быть от 1 до {MAX_ORDER_COUNT}")

    subject = db.query(Subject).filter(Subject.id == body.subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Раздел не найден")
    skill = db.query(Skill).filter(Skill.id == body.skill_id).first()
    if not skill or skill.subject_id != body.subject_id:
        raise HTTPException(status_code=400, detail="Тема не найдена или не относится к разделу")
    template = db.query(PromptTemplate).filter(PromptTemplate.id == body.prompt_template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Шаблон промпта не найден")

    # Списываем квоту ДО генерации, не после — вызов провайдера "стоит"
    # независимо от того, пройдёт ли черновик валидацию (см.
    # app/services/ai_pipeline.py). Неудачная проверка квоты ничего не списывает.
    try:
        ai_quota.check_and_consume(db, current_admin.id, body.count)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Превышена месячная квота на AI-генерацию",
        )

    order = AIGenerationOrder(
        subject_id=body.subject_id,
        skill_id=body.skill_id,
        level=body.level,
        task_type=body.task_type,
        count=body.count,
        constraints=body.constraints,
        prompt_template_id=body.prompt_template_id,
        requested_by_admin_id=current_admin.id,
    )
    db.add(order)
    db.commit()
    db.refresh(order)

    ai_pipeline.process_order(db, order)
    db.refresh(order)
    return order


@router.get("/ai/orders", response_model=List[AIGenerationOrderResponse])
def list_ai_orders(
        skill_id: Optional[int] = None,
        db: Session = Depends(get_db),
        current_admin: Admin = Depends(CAN_MANAGE_CONTENT),
):
    query = db.query(AIGenerationOrder)
    if skill_id is not None:
        query = query.filter(AIGenerationOrder.skill_id == skill_id)
    return query.order_by(AIGenerationOrder.id.desc()).all()


@router.get("/ai/orders/{order_id}", response_model=AIGenerationOrderDetailResponse)
def get_ai_order(
        order_id: int,
        db: Session = Depends(get_db),
        current_admin: Admin = Depends(CAN_MANAGE_CONTENT),
):
    order = db.query(AIGenerationOrder).filter(AIGenerationOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Заказ не найден")
    return order


@router.get("/ai/quota", response_model=AIQuotaResponse)
def get_my_ai_quota(
        db: Session = Depends(get_db),
        current_admin: Admin = Depends(CAN_MANAGE_CONTENT),
):
    """Своя квота — доступно и content_manager (не только superadmin)."""
    return ai_quota.get_or_create_quota(db, current_admin.id)


@router.get("/ai/quotas", response_model=List[AIQuotaResponse])
def list_ai_quotas(
        db: Session = Depends(get_db),
        current_admin: Admin = Depends(require_role("superadmin")),
):
    return db.query(AIQuota).all()


@router.put("/ai/quota/{admin_id}", response_model=AIQuotaResponse)
def set_ai_quota(
        admin_id: int,
        body: AIQuotaUpdateRequest,
        db: Session = Depends(get_db),
        current_admin: Admin = Depends(require_role("superadmin")),
):
    target = db.query(Admin).filter(Admin.id == admin_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Администратор не найден")
    if body.monthly_limit < 0:
        raise HTTPException(status_code=400, detail="monthly_limit не может быть отрицательным")
    return ai_quota.set_limit(db, admin_id, body.monthly_limit)
