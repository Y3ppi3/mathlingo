"""
Фаза 5: аналитика вовлечённости матричных мини-игр по телеметрии
(game_sessions/game_events/user_game_progress). Как и content_quality,
это чистые агрегаты в Python (не сырой SQL с JSON-операторами) — так
цифры одинаково считаются на Postgres и на SQLite в тестах, а типы
событий остаются свободными строками (backend их не перечисляет).

Три оси, которые нужны продукту (Duolingo-for-math): доходят ли до конца
(воронка level_start → level_complete), насколько залипают (сессии, их
длина, брошенность) и растёт ли мастерство (звёзды, освоенные уровни).
Ось «качество усвоения» (pre/post-квизы) — отдельная, это Фаза 6.
"""
from collections import defaultdict
from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from app.models import GameEvent, GameSession, UserGameProgress

# Порог «уровень освоен»: 3 звезды — это укладывание в пар (см. starsFor* во
# фронтовом движке). Держим здесь, чтобы менять определение мастерства в одном
# месте.
MASTERY_STARS = 3


def _completion_metric(payload: dict) -> Optional[float]:
    """
    Усилие на прохождение из payload level_complete: ходы (игра A) или тики
    (игра B). В обеих играх меньше = лучше; имя поля разное, поэтому берём
    первое присутствующее, а не завязываемся на конкретную игру.
    """
    for key in ("moves", "ticks"):
        value = payload.get(key)
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            return float(value)
    return None


def compute_game_engagement(db: Session, game_id: str, since: Optional[datetime] = None) -> dict:
    """
    Сводка вовлечённости по одной игре. since (если задан) ограничивает окно
    по началу сессии — для срезов «за N дней». Все доли — None при пустом
    знаменателе, чтобы фронт различал «0%» и «данных нет».
    """
    sessions_q = db.query(GameSession).filter(GameSession.game_id == game_id)
    if since is not None:
        sessions_q = sessions_q.filter(GameSession.started_at >= since)
    sessions = sessions_q.all()
    session_ids = [s.id for s in sessions]

    sessions_total = len(sessions)
    players = len({s.user_id for s in sessions})
    sessions_open = sum(1 for s in sessions if s.ended_at is None)
    durations = [
        (s.ended_at - s.started_at).total_seconds()
        for s in sessions if s.ended_at is not None
    ]
    avg_session_seconds = round(sum(durations) / len(durations), 1) if durations else None

    events = (
        db.query(GameEvent).filter(GameEvent.session_id.in_(session_ids)).all()
        if session_ids else []
    )

    starts: dict[str, int] = defaultdict(int)
    completes: dict[str, int] = defaultdict(int)
    abandons: dict[str, int] = defaultdict(int)
    stars_by_level: dict[str, list] = defaultdict(list)
    metric_by_level: dict[str, list] = defaultdict(list)
    all_stars: list[int] = []
    sessions_with_complete: set[int] = set()
    sessions_with_abandon: set[int] = set()

    for event in events:
        payload = event.payload if isinstance(event.payload, dict) else {}
        level_id = payload.get("level_id") or "—"
        if event.event_type == "level_start":
            starts[level_id] += 1
        elif event.event_type == "level_complete":
            completes[level_id] += 1
            sessions_with_complete.add(event.session_id)
            stars = payload.get("stars")
            if isinstance(stars, int) and not isinstance(stars, bool):
                stars_by_level[level_id].append(stars)
                all_stars.append(stars)
            metric = _completion_metric(payload)
            if metric is not None:
                metric_by_level[level_id].append(metric)
        elif event.event_type == "level_abandon":
            abandons[level_id] += 1
            sessions_with_abandon.add(event.session_id)

    total_starts = sum(starts.values())
    total_completes = sum(completes.values())

    level_ids = sorted(set(starts) | set(completes) | set(abandons))
    per_level = []
    for level_id in level_ids:
        s = starts[level_id]
        c = completes[level_id]
        stars = stars_by_level[level_id]
        metrics = metric_by_level[level_id]
        per_level.append({
            "level_id": level_id,
            "starts": s,
            "completes": c,
            "abandons": abandons[level_id],
            "completion_rate": round(c / s, 3) if s else None,
            "avg_stars": round(sum(stars) / len(stars), 2) if stars else None,
            "avg_metric": round(sum(metrics) / len(metrics), 2) if metrics else None,
        })

    progress = db.query(UserGameProgress).filter(UserGameProgress.game_id == game_id).all()
    mastered = [p for p in progress if p.best_stars >= MASTERY_STARS]

    return {
        "game_id": game_id,
        "players": players,
        "sessions_total": sessions_total,
        "sessions_completed": len(sessions_with_complete),
        # Брошенная = явный level_abandon и ни одного level_complete в сессии.
        "sessions_abandoned": len(sessions_with_abandon - sessions_with_complete),
        "sessions_open": sessions_open,
        "avg_session_seconds": avg_session_seconds,
        "level_starts": total_starts,
        "level_completes": total_completes,
        "completion_rate": round(total_completes / total_starts, 3) if total_starts else None,
        "avg_stars": round(sum(all_stars) / len(all_stars), 2) if all_stars else None,
        "three_star_share": round(
            sum(1 for st in all_stars if st >= MASTERY_STARS) / len(all_stars), 3
        ) if all_stars else None,
        "levels_mastered": len(mastered),
        "players_with_mastery": len({p.user_id for p in mastered}),
        "per_level": per_level,
    }
