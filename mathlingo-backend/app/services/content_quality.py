"""
R2 task 7: агрегаты по attempts для заданий + автоматическое обнаружение
аномалий у опубликованных AI-заданий. compute_task_quality — чистая
функция, переиспользуется и в эндпоинте аналитики (app/routes/admin.py),
и в check_for_anomaly ниже, чтобы оба места считали ровно одни и те же
цифры.
"""
from typing import Optional

from sqlalchemy.orm import Session

from app.models import Attempt, ContentFlag, ContentStatusHistory, Task

# Отдельное от mastery (WINDOW_SIZE=10) окно и порог — это агрегат по
# конкретному заданию, а не по ученику, консервативно шире и строже.
ANOMALY_WINDOW_SIZE = 20
MIN_SAMPLE_SIZE = 5
ANOMALY_ACCURACY_THRESHOLD = 0.25


def compute_task_quality(db: Session, task_id: int) -> dict:
    # Вторичная сортировка по id: created_at может совпадать у соседних
    # попыток (частые записи в тестах/при быстром решении), без id.desc()
    # порядок "последних N" был бы недетерминирован.
    attempts = (
        db.query(Attempt)
        .filter(Attempt.content_type == "task", Attempt.content_id == task_id)
        .order_by(Attempt.created_at.desc(), Attempt.id.desc())
        .limit(ANOMALY_WINDOW_SIZE)
        .all()
    )
    sample_size = len(attempts)
    if sample_size == 0:
        return {"sample_size": 0, "accuracy": None, "avg_time_spent_ms": None, "avg_hints_used": None}

    accuracy = sum(1 for a in attempts if a.is_correct) / sample_size
    times = [a.time_spent_ms for a in attempts if a.time_spent_ms is not None]
    avg_time = sum(times) / len(times) if times else None
    avg_hints = sum(a.hints_used for a in attempts) / sample_size

    return {
        "sample_size": sample_size,
        "accuracy": accuracy,
        "avg_time_spent_ms": avg_time,
        "avg_hints_used": avg_hints,
    }


def check_for_anomaly(db: Session, task: Task) -> Optional[ContentFlag]:
    """
    Вызывается синхронно после попытки (тот же принцип, что mastery.recompute
    в submit_answer). Срабатывает только для опубликованных AI-заданий —
    ручной контент не подлежит автоматическому возврату (см.
    docs/roadmap/product-technical-plan.md, R2 §7: "статус меняет только
    человек" — это ограничение про complaint, не про anomaly). Не плодит
    второй открытый anomaly-флаг на одно и то же задание, пока первый не
    закрыт reviewer'ом.
    """
    if task.source != "ai" or task.status != "published":
        return None

    already_open = (
        db.query(ContentFlag)
        .filter(
            ContentFlag.task_id == task.id,
            ContentFlag.flag_type == "anomaly",
            ContentFlag.status == "open",
        )
        .first()
    )
    if already_open:
        return None

    quality = compute_task_quality(db, task.id)
    if quality["sample_size"] < MIN_SAMPLE_SIZE or quality["accuracy"] is None:
        return None
    if quality["accuracy"] >= ANOMALY_ACCURACY_THRESHOLD:
        return None

    flag = ContentFlag(
        task_id=task.id,
        flag_type="anomaly",
        status="open",
        details={"accuracy": quality["accuracy"], "sample_size": quality["sample_size"]},
        created_by_admin_id=None,
    )
    db.add(flag)

    from_status = task.status
    task.status = "in_review"
    db.add(ContentStatusHistory(
        task_id=task.id,
        from_status=from_status,
        to_status="in_review",
        actor_admin_id=None,
        comment=(
            f"Автоматический возврат: точность {quality['accuracy']:.0%} "
            f"на выборке {quality['sample_size']}"
        ),
    ))

    db.commit()
    db.refresh(flag)
    return flag
