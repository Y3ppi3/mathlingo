# app/services/student_dashboard.py
"""
R4: сводка ученика (Dashboard.tsx) — раньше "Последняя активность",
"Прогресс по разделам" и очки были захардкожены на фронтенде (STATS/
RECENT/TOPICS_PROGRESS), а /gamification/progress, который фронтенд уже
пытался дёргать, не существовал вовсе. Здесь — реальные данные поверх
attempts/mastery_state/user_progress, теми же принципами, что и
app/services/dashboard.py (админский dashboard, R3 task 7): SQL-агрегация
там, где это оправдано, без лишних N+1.
"""
from datetime import date, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import Attempt, Diagnostic, GameScenario, MasteryState, Skill, Task, UserProgress

RECENT_ACTIVITY_LIMIT = 10
STREAK_LOOKBACK_ATTEMPTS = 500  # с запасом для реалистичного стрика

# Порядок соответствует MasteryState.level (см. app/services/mastery.py
# LEVELS_ORDER) — процент используется как наглядный "прогресс по теме"
# для карточки на дашборде, а не как отдельная метрика самого mastery-
# алгоритма (confidence там про другое — уверенность оценки, не прогресс).
LEVEL_PROGRESS_PCT = {"basic": 33, "standard": 66, "advanced": 100}

GAME_TEMPLATE_LABELS = {
    "derivfall": "Игра: DerivFall",
    "integralbuilder": "Игра: IntegralBuilder",
    "mathlab": "Игра: MathLab",
}

# MathLab — один template_key на несколько режимов (derivatives/integrals/
# limits, см. app/services/game_config.py) — без этого все игровые сессии
# MathLab выглядели бы в ленте активности одинаково "Игра: MathLab",
# независимо от того, в каком режиме ученик реально играл.
MATHLAB_MODE_LABELS = {
    "derivatives": "Игра: MathLab (производные)",
    "integrals": "Игра: MathLab (интегралы)",
    "limits": "Игра: Приближение (пределы)",
}


def _game_scenario_title(scenario: GameScenario) -> str:
    if scenario.template_key == "mathlab":
        mode = (scenario.config or {}).get("mode")
        return MATHLAB_MODE_LABELS.get(mode, GAME_TEMPLATE_LABELS["mathlab"])
    return GAME_TEMPLATE_LABELS.get(scenario.template_key, scenario.template_key)


def get_points(db: Session, user_id: int) -> int:
    progress = db.query(UserProgress).filter(UserProgress.user_id == user_id).first()
    return progress.total_points if progress else 0


def _calc_streak_days(db: Session, user_id: int) -> int:
    rows = (
        db.query(Attempt.created_at)
        .filter(Attempt.user_id == user_id)
        .order_by(Attempt.created_at.desc())
        .limit(STREAK_LOOKBACK_ATTEMPTS)
        .all()
    )
    if not rows:
        return 0

    # Труженее делать date() на стороне Python, а не в SQL — SQLite и
    # Postgres по-разному работают с датами (та же причина, что и
    # func.cast(...) в app/services/dashboard.py game_completion_summary).
    activity_dates = sorted({r[0].date() for r in rows}, reverse=True)

    today = date.today()
    if activity_dates[0] not in (today, today - timedelta(days=1)):
        # Последняя активность не сегодня и не вчера — стрик прерван.
        return 0

    streak = 0
    expected = activity_dates[0]
    for d in activity_dates:
        if d != expected:
            break
        streak += 1
        expected = d - timedelta(days=1)
    return streak


def activity_stats(db: Session, user_id: int) -> dict:
    attempts = db.query(Attempt).filter(Attempt.user_id == user_id).all()
    total_attempts = len(attempts)
    correct_attempts = sum(1 for a in attempts if a.is_correct)
    accuracy_pct = round(correct_attempts / total_attempts * 100) if total_attempts else 0
    total_time_hours = round(sum(a.time_spent_ms or 0 for a in attempts) / 1000 / 3600, 1)

    return {
        "total_attempts": total_attempts,
        "accuracy_pct": accuracy_pct,
        "streak_days": _calc_streak_days(db, user_id),
        "total_time_hours": total_time_hours,
        "total_points": get_points(db, user_id),
    }


def _resolve_titles(db: Session, attempts: list) -> dict:
    """content_id — generic-ссылка (см. app/models.py Attempt), поэтому
    заголовки для карточек активности резолвятся отдельным батч-запросом
    на каждый content_type, а не по одному запросу на попытку."""
    task_ids = {a.content_id for a in attempts if a.content_type == "task"}
    game_ids = {a.content_id for a in attempts if a.content_type == "game"}
    diagnostic_ids = {a.content_id for a in attempts if a.content_type == "diagnostic"}

    titles: dict = {}

    if task_ids:
        for t in db.query(Task).filter(Task.id.in_(task_ids)).all():
            titles[("task", t.id)] = t.title

    if game_ids:
        for g in db.query(GameScenario).filter(GameScenario.id.in_(game_ids)).all():
            titles[("game", g.id)] = _game_scenario_title(g)

    if diagnostic_ids:
        for d in db.query(Diagnostic).filter(Diagnostic.id.in_(diagnostic_ids)).all():
            titles[("diagnostic", d.id)] = "Диагностика по теме"

    return titles


def recent_activity(db: Session, user_id: int, limit: int = RECENT_ACTIVITY_LIMIT) -> list:
    attempts = (
        db.query(Attempt)
        .filter(Attempt.user_id == user_id)
        .order_by(Attempt.created_at.desc())
        .limit(limit)
        .all()
    )
    if not attempts:
        return []

    titles = _resolve_titles(db, attempts)
    skill_ids = {a.skill_id for a in attempts if a.skill_id is not None}
    skills = {s.id: s.name for s in db.query(Skill).filter(Skill.id.in_(skill_ids)).all()} if skill_ids else {}

    return [
        {
            "id": a.id,
            "title": titles.get((a.content_type, a.content_id), "Задание"),
            "topic": skills.get(a.skill_id, "Без темы"),
            "is_correct": a.is_correct,
            "time_spent_ms": a.time_spent_ms,
            "created_at": a.created_at,
        }
        for a in attempts
    ]


def topics_progress(db: Session, user_id: int) -> list:
    states = db.query(MasteryState).filter(MasteryState.user_id == user_id).all()
    if not states:
        return []

    skill_ids = [s.skill_id for s in states]
    skills = {s.id: s.name for s in db.query(Skill).filter(Skill.id.in_(skill_ids)).all()}

    # "done" — сколько попыток реально было по теме (не ограничено окном
    # пересчёта mastery, см. WINDOW_SIZE в app/services/mastery.py — там
    # sample_size считает только последние 10, здесь нужна честная сумма).
    done_counts = dict(
        db.query(Attempt.skill_id, func.count(Attempt.id))
        .filter(Attempt.user_id == user_id, Attempt.skill_id.in_(skill_ids))
        .group_by(Attempt.skill_id)
        .all()
    )

    return [
        {
            "skill_id": s.skill_id,
            "skill_name": skills.get(s.skill_id, "?"),
            "level": s.level,
            "progress_pct": LEVEL_PROGRESS_PCT.get(s.level, 0),
            "done": done_counts.get(s.skill_id, 0),
        }
        for s in states
        if s.skill_id in skills
    ]
