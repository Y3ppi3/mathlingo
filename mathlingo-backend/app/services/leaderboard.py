"""
Рейтинг и лидерборды по уже копящемуся прогрессу (user_game_progress). Новой
таблицы не заводим: рейтинг = сумма лучших звёзд игрока по уровням (в обеих
играх 3★ = идеальное прохождение). Сводный лидерборд — по всем играм, частный
— по одной game_id. Ничьи разрешаем по числу пройденных уровней, затем по id
(детерминированно).
"""
from collections import defaultdict
from typing import Optional

from sqlalchemy.orm import Session

from app.models import User, UserGameProgress


def compute_leaderboard(
        db: Session,
        game_id: Optional[str] = None,
        limit: int = 20,
        current_user_id: Optional[int] = None,
) -> dict:
    query = db.query(UserGameProgress)
    if game_id is not None:
        query = query.filter(UserGameProgress.game_id == game_id)

    stars: dict[int, int] = defaultdict(int)
    levels: dict[int, int] = defaultdict(int)
    for row in query.all():
        stars[row.user_id] += row.best_stars
        levels[row.user_id] += 1

    usernames = {}
    if stars:
        usernames = {
            u.id: u.username
            for u in db.query(User.id, User.username).filter(User.id.in_(stars.keys()))
        }

    # По убыванию звёзд, затем числа уровней; id — тайбрейк для стабильности.
    order = sorted(stars.keys(), key=lambda uid: (-stars[uid], -levels[uid], uid))
    ranked = [
        {
            "rank": i + 1,
            "user_id": uid,
            "username": usernames.get(uid, "—"),
            "stars": stars[uid],
            "levels_completed": levels[uid],
        }
        for i, uid in enumerate(order)
    ]

    me = None
    if current_user_id is not None:
        me = next((e for e in ranked if e["user_id"] == current_user_id), None)

    return {"game_id": game_id, "entries": ranked[:limit], "me": me}
