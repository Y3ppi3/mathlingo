# app/routes/dashboard.py
"""
R3 task 7: финальный dashboard — один эндпоинт, агрегирующий attempts/
mastery_state/ai_generation_items/content_flags/audit_log (см.
app/services/dashboard.py и docs/roadmap/product-technical-plan.md R3 §3).
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Admin
from app.schemas import DashboardOverviewResponse
from app.auth import require_role
from app.services import cache, dashboard

router = APIRouter(prefix="/admin/dashboard", tags=["dashboard"])

# Все три роли видят dashboard — teacher частично (без действий
# администраторов), см. R3 §5.
CAN_VIEW_DASHBOARD = require_role("superadmin", "content_manager", "teacher")

# R4: агрегирует несколько таблиц на каждый реквест (см.
# app/services/dashboard.py) — короткий TTL вместо point-инвалидации,
# секунды staleness продуктово не критичны для сводки. Ключ ОБЯЗАН
# учитывать include_admin_actions — иначе ответ, закешированный для
# superadmin (с действиями администраторов), мог бы отдаться teacher'у,
# которому эти данные видеть нельзя (см. R3 §5).
DASHBOARD_CACHE_TTL = 45


@router.get("/overview", response_model=DashboardOverviewResponse)
def get_dashboard_overview(
        db: Session = Depends(get_db),
        current_admin: Admin = Depends(CAN_VIEW_DASHBOARD),
):
    include_admin_actions = current_admin.role != "teacher"
    cache_key = f"dashboard_overview:{'full' if include_admin_actions else 'teacher'}"

    cached = cache.get_json(cache_key)
    if cached is not None:
        return cached

    overview = dashboard.get_overview(db, include_admin_actions=include_admin_actions)
    result_dict = DashboardOverviewResponse.model_validate(overview).model_dump(mode="json")
    cache.set_json(cache_key, result_dict, ttl=DASHBOARD_CACHE_TTL)
    return result_dict
