"""
Student-facing эндпоинт GET /gamification/game-scenarios/active/{template_key}
(R3 task 3) — источник конфига, из которого DerivFall теперь берёт задания
вместо DEFAULT_PROBLEMS (см. app/routes/gamification.py get_active_game_scenario).
"""
from datetime import datetime, timedelta

from app.models import GameScenario

VALID_CONFIG = {
    "difficulty": 3,
    "time_limit": 60,
    "problems": [
        {"id": "d1", "problem": "(x^2)'", "options": ["2x", "x", "2", "x^2"], "answer": "2x", "difficulty": "easy"},
    ],
}


def _make_scenario(db, **overrides):
    defaults = dict(template_key="derivfall", config=VALID_CONFIG, status="published", published_at=datetime.utcnow())
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


def test_requires_authentication(client):
    response = client.get("/gamification/game-scenarios/active/derivfall")
    assert response.status_code == 401


def test_unknown_template_key_rejected(client, user):
    response = client.get("/gamification/game-scenarios/active/not-a-template", headers=_student_header(user))
    assert response.status_code == 400


def test_returns_404_when_no_published_scenario(client, user):
    response = client.get("/gamification/game-scenarios/active/derivfall", headers=_student_header(user))
    assert response.status_code == 404


def test_returns_published_scenario_config(client, db, user):
    scenario = _make_scenario(db)
    response = client.get("/gamification/game-scenarios/active/derivfall", headers=_student_header(user))
    assert response.status_code == 200
    body = response.json()
    assert body["id"] == scenario.id
    assert body["config"]["problems"][0]["answer"] == "2x"
    # Полей workflow (status/preview_passed_at/created_by_admin_id) быть не должно.
    assert "status" not in body
    assert "preview_passed_at" not in body


def test_draft_scenario_not_returned(client, db, user):
    _make_scenario(db, status="draft", published_at=None)
    response = client.get("/gamification/game-scenarios/active/derivfall", headers=_student_header(user))
    assert response.status_code == 404


def test_archived_scenario_not_returned(client, db, user):
    _make_scenario(db, status="archived")
    response = client.get("/gamification/game-scenarios/active/derivfall", headers=_student_header(user))
    assert response.status_code == 404


def test_not_yet_available_scenario_excluded(client, db, user):
    _make_scenario(db, availability_from=datetime.utcnow() + timedelta(days=1))
    response = client.get("/gamification/game-scenarios/active/derivfall", headers=_student_header(user))
    assert response.status_code == 404


def test_expired_scenario_excluded(client, db, user):
    _make_scenario(db, availability_to=datetime.utcnow() - timedelta(days=1))
    response = client.get("/gamification/game-scenarios/active/derivfall", headers=_student_header(user))
    assert response.status_code == 404


def test_currently_available_scenario_included(client, db, user):
    _make_scenario(
        db,
        availability_from=datetime.utcnow() - timedelta(days=1),
        availability_to=datetime.utcnow() + timedelta(days=1),
    )
    response = client.get("/gamification/game-scenarios/active/derivfall", headers=_student_header(user))
    assert response.status_code == 200


def test_most_recently_published_scenario_wins(client, db, user):
    _make_scenario(db, published_at=datetime.utcnow() - timedelta(days=1))
    newer = _make_scenario(db, published_at=datetime.utcnow())
    response = client.get("/gamification/game-scenarios/active/derivfall", headers=_student_header(user))
    assert response.status_code == 200
    assert response.json()["id"] == newer.id


def test_other_template_key_not_matched(client, db, user):
    _make_scenario(db, template_key="integralbuilder", config={
        "initial_difficulty": 3, "time_limit": 300,
        "problems": [{"id": "i1", "question": "x", "solution_pieces": ["y"], "difficulty": "easy"}],
    })
    response = client.get("/gamification/game-scenarios/active/derivfall", headers=_student_header(user))
    assert response.status_code == 404
