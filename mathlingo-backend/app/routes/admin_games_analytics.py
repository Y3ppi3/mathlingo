# app/routes/admin_games_analytics.py
"""
Фаза 5: чтение аналитики вовлечённости матричных мини-игр для admin-панели.
Только чтение агрегатов (app/services/game_analytics.py) — сырую телеметрию
эндпоинт не отдаёт. Роль как у аналитики качества (CAN_VIEW_QUALITY): её
смотрят teacher/content_manager/superadmin.

Живёт под /admin (вне CSRF, авторизация — adminToken Bearer), рядом с
admin_content_quality — это соседний «аналитический» домен админки.
"""
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Admin, GameSession
from app.routes._admin_rbac import CAN_VIEW_QUALITY
from app.schemas import GamesAnalyticsResponse, LearningAnalyticsResponse
from app.services.assessment import compute_learning_delta
from app.services.game_analytics import compute_game_engagement

router = APIRouter(prefix="/admin", tags=["admin_games_analytics"])


@router.get("/games/analytics", response_model=GamesAnalyticsResponse)
def get_games_analytics(
        game_id: Optional[str] = None,
        days: Optional[int] = Query(default=None, ge=1, le=365),
        db: Session = Depends(get_db),
        current_admin: Admin = Depends(CAN_VIEW_QUALITY),
):
    """
    Сводка вовлечённости по играм. Без параметров — по всем известным играм за
    всё время. game_id сужает до одной игры (404 на неизвестную), days — до
    окна в N последних дней (по началу сессии).
    """
    if game_id is not None and game_id not in GameSession.GAME_IDS:
        raise HTTPException(status_code=404, detail="Unknown game_id")

    game_ids = [game_id] if game_id else list(GameSession.GAME_IDS)
    since = datetime.utcnow() - timedelta(days=days) if days else None

    return GamesAnalyticsResponse(
        since=since,
        games=[compute_game_engagement(db, gid, since) for gid in game_ids],
    )


@router.get("/games/learning", response_model=LearningAnalyticsResponse)
def get_learning_analytics(
        db: Session = Depends(get_db),
        current_admin: Admin = Depends(CAN_VIEW_QUALITY),
):
    """
    Ось «качество усвоения»: средние pre/post и Δ по пользователям, сдавшим оба
    теста, с разбивкой по игре, в которую они играли больше (см. Фаза 6).
    """
    return compute_learning_delta(db)
