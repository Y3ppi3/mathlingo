"""
Golden-тесты пост-публикационного мониторинга (R2 task 7): агрегаты
compute_task_quality и автоматическое обнаружение аномалий
check_for_anomaly. Любое изменение порогов в app/services/content_quality.py
должно быть видно здесь одним диффом.
"""
from app.services import content_quality


def _make_task(db, subject, **overrides):
    from app.models import Task

    defaults = dict(
        title="AI task", subject=subject.code, subject_id=subject.id,
        status="published", source="ai", answer_type="single_answer",
        content="<p>2+2=?</p>", correct_answer="4",
    )
    defaults.update(overrides)
    task = Task(**defaults)
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def _add_attempts(db, user, task, results, time_spent_ms=None, hints_used=0):
    from app.models import Attempt

    for is_correct in results:
        db.add(Attempt(
            user_id=user.id, content_type="task", content_id=task.id,
            skill_id=task.skill_id, is_correct=is_correct,
            time_spent_ms=time_spent_ms, hints_used=hints_used,
        ))
    db.commit()


# --- compute_task_quality ---

def test_compute_quality_with_no_attempts_returns_zero_sample(client, db, subject):
    task = _make_task(db, subject)
    result = content_quality.compute_task_quality(db, task.id)
    assert result == {"sample_size": 0, "accuracy": None, "avg_time_spent_ms": None, "avg_hints_used": None}


def test_compute_quality_averages_correctly(client, db, user, subject):
    task = _make_task(db, subject)
    _add_attempts(db, user, task, [True, True, False, True], time_spent_ms=1000, hints_used=1)

    result = content_quality.compute_task_quality(db, task.id)
    assert result["sample_size"] == 4
    assert result["accuracy"] == 0.75
    assert result["avg_time_spent_ms"] == 1000
    assert result["avg_hints_used"] == 1


def test_compute_quality_only_counts_last_window(client, db, user, subject):
    task = _make_task(db, subject)
    # 20 верных + 5 неверных сверху окна (ANOMALY_WINDOW_SIZE=20) — в окно
    # должны попасть только последние 20 по вставке: 15 оставшихся верных
    # + 5 новых неверных, а не все 20 верных.
    _add_attempts(db, user, task, [True] * 20)
    _add_attempts(db, user, task, [False] * 5)

    result = content_quality.compute_task_quality(db, task.id)
    assert result["sample_size"] == 20
    assert result["accuracy"] == 0.75


# --- check_for_anomaly ---

def test_no_anomaly_for_manual_task(client, db, user, subject):
    task = _make_task(db, subject, source="manual")
    _add_attempts(db, user, task, [False] * 10)

    flag = content_quality.check_for_anomaly(db, task)
    assert flag is None
    assert task.status == "published"


def test_no_anomaly_for_unpublished_ai_task(client, db, user, subject):
    task = _make_task(db, subject, status="draft")
    _add_attempts(db, user, task, [False] * 10)

    flag = content_quality.check_for_anomaly(db, task)
    assert flag is None


def test_no_anomaly_below_min_sample_size(client, db, user, subject):
    task = _make_task(db, subject)
    _add_attempts(db, user, task, [False] * (content_quality.MIN_SAMPLE_SIZE - 1))

    flag = content_quality.check_for_anomaly(db, task)
    assert flag is None
    assert task.status == "published"


def test_no_anomaly_when_accuracy_healthy(client, db, user, subject):
    task = _make_task(db, subject)
    _add_attempts(db, user, task, [True, True, True, True, False])  # accuracy 0.8

    flag = content_quality.check_for_anomaly(db, task)
    assert flag is None
    assert task.status == "published"


def test_anomaly_flag_created_and_task_reverted_to_in_review(client, db, user, subject):
    task = _make_task(db, subject)
    _add_attempts(db, user, task, [False, False, False, False, True])  # accuracy 0.2

    flag = content_quality.check_for_anomaly(db, task)

    assert flag is not None
    assert flag.flag_type == "anomaly"
    assert flag.status == "open"
    assert flag.task_id == task.id
    assert flag.created_by_admin_id is None
    assert flag.details["accuracy"] == 0.2
    assert task.status == "in_review"


def test_anomaly_history_row_has_system_actor(client, db, user, subject):
    from app.models import ContentStatusHistory

    task = _make_task(db, subject)
    _add_attempts(db, user, task, [False] * 5)
    content_quality.check_for_anomaly(db, task)

    history = db.query(ContentStatusHistory).filter(ContentStatusHistory.task_id == task.id).all()
    assert len(history) == 1
    assert history[0].from_status == "published"
    assert history[0].to_status == "in_review"
    assert history[0].actor_admin_id is None


def test_does_not_duplicate_open_anomaly_flag(client, db, user, subject):
    task = _make_task(db, subject)
    _add_attempts(db, user, task, [False] * 5)

    first = content_quality.check_for_anomaly(db, task)
    assert first is not None

    # Задание уже не published (ушло в in_review) — повторный вызов no-op
    # уже по статусу, но проверяем и сам guard на дубликат явно.
    task.status = "published"
    db.commit()
    second = content_quality.check_for_anomaly(db, task)
    assert second is None
