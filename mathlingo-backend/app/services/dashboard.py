"""
R3 task 7: финальный dashboard — сводные агрегации поверх attempts,
mastery_state, ai_generation_items, content_flags и audit_log (см.
docs/roadmap/product-technical-plan.md, R3 §3, §9 задача 7). Все запросы
используют SQL-агрегацию (group by/count/avg), а не выгрузку строк в Python,
и опираются на ix_attempts_created_at_content_type_skill_id (см. миграцию
9af2ea949ea8) — без него activity/game-завершаемость упирались бы в full
scan на реальном объёме попыток.
"""
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy import Integer, func
from sqlalchemy.orm import Session

from app.models import (
    Admin, AIGenerationItem, Attempt, AuditLog, ContentFlag,
    GameScenario, MasteryState, Skill, Task,
)

ACTIVITY_WINDOW_DAYS = 30
RECENT_ADMIN_ACTIONS_LIMIT = 15


def activity_summary(db: Session, days: int = ACTIVITY_WINDOW_DAYS) -> dict:
    since = datetime.utcnow() - timedelta(days=days)
    rows = (
        db.query(Attempt.content_type, func.count(Attempt.id), func.count(func.distinct(Attempt.user_id)))
        .filter(Attempt.created_at >= since)
        .group_by(Attempt.content_type)
        .all()
    )
    by_content_type = {content_type: {"attempts": count, "active_users": users} for content_type, count, users in rows}
    total_attempts = sum(v["attempts"] for v in by_content_type.values())
    total_active_users = (
        db.query(func.count(func.distinct(Attempt.user_id)))
        .filter(Attempt.created_at >= since)
        .scalar() or 0
    )
    return {
        "window_days": days,
        "total_attempts": total_attempts,
        "active_users": total_active_users,
        "by_content_type": by_content_type,
    }


def skill_progress_summary(db: Session) -> list:
    rows = (
        db.query(Skill.id, Skill.name, MasteryState.level, func.count(MasteryState.id), func.avg(MasteryState.confidence))
        .join(MasteryState, MasteryState.skill_id == Skill.id)
        .group_by(Skill.id, Skill.name, MasteryState.level)
        .all()
    )
    by_skill: dict = {}
    for skill_id, skill_name, level, count, avg_confidence in rows:
        entry = by_skill.setdefault(skill_id, {"skill_id": skill_id, "skill_name": skill_name, "levels": {}, "avg_confidence": []})
        entry["levels"][level] = count
        entry["avg_confidence"].append((count, avg_confidence or 0))

    result = []
    for entry in by_skill.values():
        total = sum(entry["levels"].values())
        weighted = sum(c * a for c, a in entry["avg_confidence"])
        result.append({
            "skill_id": entry["skill_id"],
            "skill_name": entry["skill_name"],
            "student_count": total,
            "levels": entry["levels"],
            "avg_confidence": round(weighted / total, 1) if total else 0,
        })
    return result


def game_completion_summary(db: Session) -> list:
    # is_correct — Boolean; avg() требует явный cast в Integer, чтобы
    # одинаково работать и на Postgres, и на SQLite (тесты).
    rows = (
        db.query(
            GameScenario.template_key,
            func.count(Attempt.id),
            func.avg(func.cast(Attempt.is_correct, Integer)),
            func.avg(Attempt.time_spent_ms),
        )
        .select_from(Attempt)
        .join(GameScenario, GameScenario.id == Attempt.content_id)
        .filter(Attempt.content_type == "game")
        .group_by(GameScenario.template_key)
        .all()
    )
    return [
        {
            "template_key": template_key,
            "sessions": sessions,
            "pass_rate": round(pass_rate, 3) if pass_rate is not None else None,
            "avg_time_spent_ms": round(avg_time) if avg_time is not None else None,
        }
        for template_key, sessions, pass_rate, avg_time in rows
    ]


def ai_quality_summary(db: Session) -> dict:
    published_ai_tasks = db.query(func.count(Task.id)).filter(Task.source == "ai", Task.status == "published").scalar() or 0
    open_anomalies = db.query(func.count(ContentFlag.id)).filter(ContentFlag.flag_type == "anomaly", ContentFlag.status == "open").scalar() or 0
    open_complaints = db.query(func.count(ContentFlag.id)).filter(ContentFlag.flag_type == "complaint", ContentFlag.status == "open").scalar() or 0
    return {
        "published_ai_tasks": published_ai_tasks,
        "open_anomaly_flags": open_anomalies,
        "open_complaint_flags": open_complaints,
    }


def review_queue_summary(db: Session) -> dict:
    tasks_in_review = db.query(func.count(Task.id)).filter(Task.status == "in_review").scalar() or 0
    ai_items_pending = db.query(func.count(AIGenerationItem.id)).filter(AIGenerationItem.status == "pending").scalar() or 0
    return {
        "tasks_in_review": tasks_in_review,
        "ai_items_pending": ai_items_pending,
    }


def publish_errors_summary(db: Session) -> dict:
    rows = (
        db.query(AIGenerationItem.status, func.count(AIGenerationItem.id))
        .filter(AIGenerationItem.status.in_(["failed_generation", "failed_validation", "failed_answer_check"]))
        .group_by(AIGenerationItem.status)
        .all()
    )
    return {status: count for status, count in rows}


def admin_activity_summary(db: Session, limit: int = RECENT_ADMIN_ACTIONS_LIMIT) -> list:
    rows = (
        db.query(AuditLog, Admin.username)
        .outerjoin(Admin, Admin.id == AuditLog.actor_admin_id)
        .order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": log.id,
            "actor_username": username,
            "actor_role": log.actor_role,
            "method": log.method,
            "path": log.path,
            "action": log.action,
            "status_code": log.status_code,
            "created_at": log.created_at,
        }
        for log, username in rows
    ]


def get_overview(db: Session, include_admin_actions: bool) -> dict:
    """
    include_admin_actions=False для teacher (см. R3 §5: "просмотр
    финального dashboard... частично, без раздела действий
    администраторов") — раздел просто отсутствует в ответе, а не пустой
    список, чтобы фронтенду не пришлось гадать "пусто" это или "не видно".
    """
    overview = {
        "activity": activity_summary(db),
        "skill_progress": skill_progress_summary(db),
        "game_completion": game_completion_summary(db),
        "ai_quality": ai_quality_summary(db),
        "review_queue": review_queue_summary(db),
        "publish_errors": publish_errors_summary(db),
        "admin_actions": admin_activity_summary(db) if include_admin_actions else None,
    }
    return overview
