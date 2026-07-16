# app/routes/games.py
"""
Матричные мини-игры, Фаза 0 — телеметрия, прогресс и конфиг уровней.

Гибридная модель: завершение игры («уровень пройден» с очками) по-прежнему
идёт через POST /gamification/game-scenarios/{id}/submit-attempt -> attempts
(дашборд + mastery). Здесь — то, чего в той системе нет:

  POST /api/games/events           батч гранулярной телеметрии (Фаза 5)
  GET  /api/games/progress         межсессионный прогресс по уровням
  POST /api/games/progress         апсерт лучшего результата на уровне
  GET  /api/games/levels/{game_id} конфиг уровней (Фаза 0 — мок)

Мутирующие эндпоинты автоматически защищены CSRF-middleware в main.py (путь
не /admin, метод POST, есть auth-cookie) — фронтенд обязан слать их через
общий api-axios-инстанс с X-CSRF-Token.
"""
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import GameEvent, GameSession, User, UserGameProgress
from app.schemas import (
    GameCatalogResponse,
    GameEventsBatchRequest, GameEventsBatchResponse,
    GameLevelConfig, GameLevelsResponse,
    GameProgressResponse, GameProgressUpsertRequest,
    LeaderboardResponse,
)
from app.services.game_catalog import get_catalog
from app.services.leaderboard import compute_leaderboard

router = APIRouter(prefix="/api/games", tags=["games"])


# Мок-конфиг уровней (Фаза 0, критерий готовности — «эндпоинты отвечают на
# моках»). В Фазах 1–4 источником станет опубликованный GameScenario
# (fetchActiveGameScenario), а не этот словарь — прогрессия 2x2 -> 3x3 и
# бюджеты итераций придут из геймдизайн-ТЗ. params намеренно placeholder.
_MOCK_LEVELS = {
    "gauss_jordan": [
        GameLevelConfig(level_id="gj-1", title="Разминка 2×2", difficulty=1, params={"size": 2}),
        GameLevelConfig(level_id="gj-2", title="Дроби 2×2", difficulty=2, params={"size": 2}),
        GameLevelConfig(level_id="gj-3", title="Первая 3×3", difficulty=3, params={"size": 3}),
        GameLevelConfig(level_id="gj-4", title="Перестановки строк", difficulty=4, params={"size": 3}),
        GameLevelConfig(level_id="gj-5", title="Испытание 3×3", difficulty=5, params={"size": 3}),
    ],
    "eigen_arrow": [
        GameLevelConfig(level_id="ea-1", title="Явная сходимость", difficulty=1, params={"iter_budget": 8}),
        GameLevelConfig(level_id="ea-2", title="Медленная сходимость", difficulty=2, params={"iter_budget": 12}),
        GameLevelConfig(level_id="ea-3", title="Седловина", difficulty=3, params={"iter_budget": 12}),
        GameLevelConfig(level_id="ea-4", title="Близкие λ", difficulty=4, params={"iter_budget": 16}),
        GameLevelConfig(level_id="ea-5", title="Вихрь", difficulty=5, params={"iter_budget": 16, "is_vortex": True}),
    ],
}


@router.get("/catalog", response_model=GameCatalogResponse)
def get_games_catalog(current_user: User = Depends(get_current_user)):
    """Единый каталог всех игр с тегами уровней. Фильтрация по уровню ученика —
    на фронте (одна выборка + тумблер «показать все»)."""
    return GameCatalogResponse(entries=get_catalog())


@router.get("/leaderboard", response_model=LeaderboardResponse)
def get_leaderboard(
        game_id: Optional[str] = Query(default=None),
        limit: int = Query(default=20, ge=1, le=100),
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user),
):
    """Рейтинг по сумме звёзд. Без game_id — сводный по всем играм; с game_id —
    по одной игре. Всегда возвращает позицию текущего игрока (me), даже вне топа."""
    return compute_leaderboard(db, game_id=game_id, limit=limit, current_user_id=current_user.id)


@router.get("/levels/{game_id}", response_model=GameLevelsResponse)
def get_game_levels(
        game_id: str,
        current_user: User = Depends(get_current_user),
):
    levels = _MOCK_LEVELS.get(game_id)
    if levels is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Неизвестная игра")
    return GameLevelsResponse(game_id=game_id, levels=levels)


@router.post("/events", response_model=GameEventsBatchResponse)
def post_game_events(
        body: GameEventsBatchRequest,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user),
):
    """
    Приём батча телеметрии. Без session_id открывает новую сессию и возвращает
    её id (клиент кладёт его в последующие батчи). Проверяет, что переданная
    сессия принадлежит текущему пользователю и той же игре — иначе нельзя
    писать события в чужую/другую сессию.
    """
    if body.session_id is not None:
        session = (
            db.query(GameSession)
            .filter(GameSession.id == body.session_id, GameSession.user_id == current_user.id)
            .first()
        )
        if session is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Сессия не найдена")
        if session.game_id != body.game_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="game_id не совпадает с сессией")
    else:
        session = GameSession(user_id=current_user.id, game_id=body.game_id, started_at=datetime.utcnow())
        db.add(session)
        db.flush()  # нужен session.id для событий ниже

    for ev in body.events:
        db.add(GameEvent(
            session_id=session.id,
            event_type=ev.event_type,
            payload=ev.payload,
            client_ts=ev.client_ts,
        ))

    # Закрываем сессию только один раз — повторный end_session по уже
    # закрытой сессии не сдвигает ended_at.
    if body.end_session and session.ended_at is None:
        session.ended_at = datetime.utcnow()

    db.commit()
    return GameEventsBatchResponse(session_id=session.id, accepted=len(body.events))


@router.get("/progress", response_model=List[GameProgressResponse])
def get_game_progress(
        game_id: Optional[str] = Query(default=None),
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user),
):
    query = db.query(UserGameProgress).filter(UserGameProgress.user_id == current_user.id)
    if game_id is not None:
        query = query.filter(UserGameProgress.game_id == game_id)
    return query.all()


@router.post("/progress", response_model=GameProgressResponse)
def upsert_game_progress(
        body: GameProgressUpsertRequest,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user),
):
    """
    Апсерт лучшего результата на уровне. «Лучше» = больше звёзд; при равных
    звёздах — меньше метрика (ходы/итерации). Худший результат не затирает
    прошлый рекорд.
    """
    row = (
        db.query(UserGameProgress)
        .filter(
            UserGameProgress.user_id == current_user.id,
            UserGameProgress.game_id == body.game_id,
            UserGameProgress.level_id == body.level_id,
        )
        .first()
    )

    if row is None:
        row = UserGameProgress(
            user_id=current_user.id,
            game_id=body.game_id,
            level_id=body.level_id,
            best_stars=body.stars,
            best_metric=body.metric,
            completed_at=datetime.utcnow(),
        )
        db.add(row)
    else:
        better_stars = body.stars > row.best_stars
        same_stars_better_metric = (
            body.stars == row.best_stars
            and body.metric is not None
            and (row.best_metric is None or body.metric < row.best_metric)
        )
        if better_stars or same_stars_better_metric:
            row.best_stars = body.stars
            row.best_metric = body.metric
            row.completed_at = datetime.utcnow()

    db.commit()
    db.refresh(row)
    return row
