"""
R2 task 6: месячная квота на AI-генерацию. Списывается по order.count
(запрошенное количество), а не по числу успешно прошедших конвейер item'ов —
вызов провайдера сделан независимо от исхода валидации/санитизации (см.
app/services/ai_pipeline.py). Сброс периода — ленивый, при первом обращении
в новом месяце, отдельного cron/job в проекте нет.
"""
from datetime import datetime

from sqlalchemy.orm import Session

from app.models import AIQuota

# Дефолт для нового админа, пока superadmin явно не задал свой лимит —
# заведомо ненулевой (иначе content_manager при первом же заказе упрётся
# в отказ без объяснимой причины), но и не безлимитный.
DEFAULT_MONTHLY_LIMIT = 50


def _current_period() -> str:
    return datetime.utcnow().strftime("%Y-%m")


def get_or_create_quota(db: Session, admin_id: int) -> AIQuota:
    quota = db.query(AIQuota).filter(AIQuota.admin_id == admin_id).first()
    period = _current_period()

    if not quota:
        quota = AIQuota(admin_id=admin_id, period=period, monthly_limit=DEFAULT_MONTHLY_LIMIT, used=0)
        db.add(quota)
        db.commit()
        db.refresh(quota)
        return quota

    if quota.period != period:
        quota.period = period
        quota.used = 0
        db.commit()
        db.refresh(quota)
    return quota


def check_and_consume(db: Session, admin_id: int, amount: int) -> AIQuota:
    """Поднимает ValueError("quota_exceeded"), не трогая used, если лимит превышен."""
    quota = get_or_create_quota(db, admin_id)
    if quota.used + amount > quota.monthly_limit:
        raise ValueError("quota_exceeded")

    quota.used += amount
    db.commit()
    db.refresh(quota)
    return quota


def set_limit(db: Session, admin_id: int, monthly_limit: int) -> AIQuota:
    quota = get_or_create_quota(db, admin_id)
    quota.monthly_limit = monthly_limit
    db.commit()
    db.refresh(quota)
    return quota
