# tests/test_student_dashboard.py
"""
R4: GET /gamification/dashboard — раньше "Последняя активность", "Прогресс
по разделам" и очки на Dashboard.tsx были захардкожены на фронтенде, а
/gamification/progress, который фронтенд уже пытался дёргать, не
существовал вовсе (см. app/services/student_dashboard.py).
"""
from datetime import datetime, timedelta

from app.models import Attempt, GameScenario, MasteryState, Skill, Task, UserProgress
from app.services import student_dashboard


def _student_header(user):
    from app.auth import create_access_token

    token = create_access_token({"sub": user.email})
    return {"Authorization": f"Bearer {token}"}


def _make_skill(db, subject, code="derivatives"):
    skill = Skill(subject_id=subject.id, name="Производные", code=code)
    db.add(skill)
    db.commit()
    db.refresh(skill)
    return skill


def test_dashboard_is_empty_for_new_user(client, user):
    response = client.get("/gamification/dashboard", headers=_student_header(user))

    assert response.status_code == 200
    body = response.json()
    assert body["activity"] == {
        "total_attempts": 0, "accuracy_pct": 0, "streak_days": 0,
        "total_time_hours": 0.0, "total_points": 0,
    }
    assert body["recent_activity"] == []
    assert body["topics_progress"] == []


def test_dashboard_reflects_real_attempts_and_points(client, db, user, subject):
    skill = _make_skill(db, subject)
    task = Task(title="Найти производную", subject=subject.code, subject_id=subject.id, skill_id=skill.id, status="published")
    db.add(task)
    db.commit()
    db.refresh(task)

    db.add(Attempt(user_id=user.id, content_type="task", content_id=task.id, skill_id=skill.id, is_correct=True, time_spent_ms=30000))
    db.add(Attempt(user_id=user.id, content_type="task", content_id=task.id, skill_id=skill.id, is_correct=False, time_spent_ms=60000))
    db.add(UserProgress(user_id=user.id, total_points=15, completed_locations="[]", unlocked_achievements="[]"))
    db.commit()

    response = client.get("/gamification/dashboard", headers=_student_header(user))
    assert response.status_code == 200
    body = response.json()

    assert body["activity"]["total_attempts"] == 2
    assert body["activity"]["accuracy_pct"] == 50
    assert body["activity"]["total_points"] == 15
    assert body["activity"]["total_time_hours"] == round(90000 / 1000 / 3600, 1)

    assert len(body["recent_activity"]) == 2
    assert body["recent_activity"][0]["title"] == "Найти производную"
    assert body["recent_activity"][0]["topic"] == "Производные"


# R4: MathLab — один template_key на несколько режимов (derivatives/
# integrals/limits) — без учёта mode вся игровая активность выглядела бы
# одинаково "Игра: MathLab" независимо от того, в каком режиме играли.
def test_dashboard_distinguishes_mathlab_modes_in_activity_titles(client, db, user):
    scenario = GameScenario(
        template_key="mathlab", status="published",
        config={"template_key": "mathlab", "mode": "limits", "difficulty": 3, "tasks": []},
    )
    db.add(scenario)
    db.commit()
    db.refresh(scenario)

    db.add(Attempt(user_id=user.id, content_type="game", content_id=scenario.id, is_correct=True, source="game"))
    db.commit()

    response = client.get("/gamification/dashboard", headers=_student_header(user))
    assert response.status_code == 200
    assert response.json()["recent_activity"][0]["title"] == "Игра: Приближение (пределы)"


def test_dashboard_topics_progress_reflects_mastery_level(client, db, user, subject):
    skill = _make_skill(db, subject)
    db.add(MasteryState(user_id=user.id, skill_id=skill.id, level="advanced", confidence=90, sample_size=10))
    db.add(Attempt(user_id=user.id, content_type="task", content_id=1, skill_id=skill.id, is_correct=True))
    db.add(Attempt(user_id=user.id, content_type="task", content_id=1, skill_id=skill.id, is_correct=True))
    db.commit()

    response = client.get("/gamification/dashboard", headers=_student_header(user))
    assert response.status_code == 200
    topics = response.json()["topics_progress"]

    assert len(topics) == 1
    assert topics[0]["skill_name"] == "Производные"
    assert topics[0]["level"] == "advanced"
    assert topics[0]["progress_pct"] == 100
    assert topics[0]["done"] == 2


def test_streak_days_counts_consecutive_days_only(client, db, user):
    today = datetime.utcnow()
    db.add(Attempt(user_id=user.id, content_type="task", content_id=1, is_correct=True, created_at=today))
    db.add(Attempt(user_id=user.id, content_type="task", content_id=1, is_correct=True, created_at=today - timedelta(days=1)))
    db.add(Attempt(user_id=user.id, content_type="task", content_id=1, is_correct=True, created_at=today - timedelta(days=2)))
    # Разрыв на days=3 — активность до этого не должна учитываться в стрике.
    db.add(Attempt(user_id=user.id, content_type="task", content_id=1, is_correct=True, created_at=today - timedelta(days=5)))
    db.commit()

    assert student_dashboard._calc_streak_days(db, user.id) == 3


def test_streak_is_zero_if_no_activity_today_or_yesterday(client, db, user):
    old = datetime.utcnow() - timedelta(days=5)
    db.add(Attempt(user_id=user.id, content_type="task", content_id=1, is_correct=True, created_at=old))
    db.commit()

    assert student_dashboard._calc_streak_days(db, user.id) == 0
