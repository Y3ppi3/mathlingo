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
from app.services import dashboard

router = APIRouter(prefix="/admin/dashboard", tags=["dashboard"])

# Все три роли видят dashboard — teacher частично (без действий
# администраторов), см. R3 §5.
CAN_VIEW_DASHBOARD = require_role("superadmin", "content_manager", "teacher")


@router.get("/overview", response_model=DashboardOverviewResponse)
def get_dashboard_overview(
        db: Session = Depends(get_db),
        current_admin: Admin = Depends(CAN_VIEW_DASHBOARD),
):
    return dashboard.get_overview(db, include_admin_actions=current_admin.role != "teacher")
