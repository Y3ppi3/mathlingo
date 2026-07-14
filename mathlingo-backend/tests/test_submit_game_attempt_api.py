"""
HTTP-тесты POST /gamification/game-scenarios/{id}/submit-attempt (R3 task 6)
— эндпоинт, которым игры отчитываются о завершённой сессии. Валидирует, что
content_id — активный (опубликованный, в окне доступности) game_scenario,
как того требует план (R3 §3).
"""
from datetime import datetime, timedelta

from app.models import Attempt, GameScenario, UserProgress


def _make_scenario(db, **overrides):
    defaults = dict(
        template_key="derivfall",
        config={"template_key": "derivfall", "difficulty": 3, "time_limit": 60, "problems": []},
        status="published",
    )
    defaults.update(overrides)
    scenario = GameScenario(**defaults)
    db.add(scenario)
    db.commit()
    db.refresh(scenario)
    return scenario


def _student_header(user):
    from app.auth import create_access_token

    token = create_access_token({"sub": user.email})
    return {"Authorization": f"Bearer {token}"}


def test_requires_authentication(client, db):
    scenario = _make_scenario(db)
    response = client.post(f"/gamification/game-scenarios/{scenario.id}/submit-attempt", json={"score": 10, "max_score": 20})
    assert response.status_code == 401


def test_unknown_scenario_404(client, user):
    response = client.post("/gamification/game-scenarios/999999/submit-attempt", headers=_student_header(user), json={"score": 10, "max_score": 20})
    assert response.status_code == 404


def test_draft_scenario_rejected(client, db, user):
    scenario = _make_scenario(db, status="draft")
    response = client.post(f"/gamification/game-scenarios/{scenario.id}/submit-attempt", headers=_student_header(user), json={"score": 10, "max_score": 20})
    assert response.status_code == 409


def test_archived_scenario_rejected(client, db, user):
    scenario = _make_scenario(db, status="archived")
    response = client.post(f"/gamification/game-scenarios/{scenario.id}/submit-attempt", headers=_student_header(user), json={"score": 10, "max_score": 20})
    assert response.status_code == 409


def test_outside_availability_window_rejected(client, db, user):
    scenario = _make_scenario(db, availability_from=datetime.utcnow() + timedelta(days=1))
    response = client.post(f"/gamification/game-scenarios/{scenario.id}/submit-attempt", headers=_student_header(user), json={"score": 10, "max_score": 20})
    assert response.status_code == 409


def test_successful_submission_creates_attempt(client, db, user):
    scenario = _make_scenario(db)
    response = client.post(
        f"/gamification/game-scenarios/{scenario.id}/submit-attempt",
        headers=_student_header(user),
        json={"score": 15, "max_score": 20, "time_spent_ms": 45000},
    )
    assert response.status_code == 200
    assert response.json()["is_correct"] is True

    attempt = db.query(Attempt).filter(Attempt.user_id == user.id, Attempt.content_type == "game").first()
    assert attempt is not None
    assert attempt.content_id == scenario.id
    assert attempt.source == "game"
    assert attempt.time_spent_ms == 45000


# R4: раньше игровые сессии не начисляли очки вообще — только submit_answer
# для обычных заданий (см. app/services/game_attempts.py).
def test_successful_submission_awards_points(client, db, user):
    scenario = _make_scenario(db)
    response = client.post(
        f"/gamification/game-scenarios/{scenario.id}/submit-attempt",
        headers=_student_header(user),
        json={"score": 20, "max_score": 20},
    )
    assert response.status_code == 200

    progress = db.query(UserProgress).filter(UserProgress.user_id == user.id).first()
    assert progress is not None
    assert progress.total_points == 20  # 100% от GAME_SESSION_REWARD_POINTS


def test_failed_submission_awards_no_points(client, db, user):
    scenario = _make_scenario(db)
    response = client.post(
        f"/gamification/game-scenarios/{scenario.id}/submit-attempt",
        headers=_student_header(user),
        json={"score": 2, "max_score": 20},  # ниже GAME_SESSION_PASS_THRESHOLD
    )
    assert response.status_code == 200
    assert response.json()["is_correct"] is False

    progress = db.query(UserProgress).filter(UserProgress.user_id == user.id).first()
    assert progress is None or progress.total_points == 0
