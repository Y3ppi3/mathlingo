"""
Student-facing эндпоинт GET /gamification/game-scenarios/active/{template_key}
(R3 task 3/4) — источник конфига, из которого DerivFall/IntegralBuilder/
MathLab теперь берут задания вместо своих хардкодов (см.
app/routes/gamification.py get_active_game_scenario). Фильтр ?mode= (R3
task 4) нужен только mathlab — derivatives/integrals делят один
template_key, но это разные опубликованные сценарии.
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

MATHLAB_CONFIG = {
    "difficulty": 3,
    "tasks": [
        {"id": "t1", "type": "calculate", "question": "Найдите производную x^2", "function_expression": "x^2", "correct_answer": "2x", "difficulty": 3, "hints": []},
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


# --- ?mode= фильтр (R3 task 4, только mathlab) ---

def test_mode_filter_selects_matching_scenario(client, db, user):
    derivatives_config = dict(MATHLAB_CONFIG, mode="derivatives")
    integrals_config = dict(MATHLAB_CONFIG, mode="integrals")
    deriv_scenario = _make_scenario(db, template_key="mathlab", config=derivatives_config)
    _make_scenario(db, template_key="mathlab", config=integrals_config)

    response = client.get("/gamification/game-scenarios/active/mathlab?mode=derivatives", headers=_student_header(user))
    assert response.status_code == 200
    assert response.json()["id"] == deriv_scenario.id
    assert response.json()["config"]["mode"] == "derivatives"


def test_mode_filter_404_when_no_scenario_for_that_mode(client, db, user):
    _make_scenario(db, template_key="mathlab", config=dict(MATHLAB_CONFIG, mode="derivatives"))
    response = client.get("/gamification/game-scenarios/active/mathlab?mode=integrals", headers=_student_header(user))
    assert response.status_code == 404


def test_without_mode_filter_returns_most_recent_regardless_of_mode(client, db, user):
    _make_scenario(db, template_key="mathlab", config=dict(MATHLAB_CONFIG, mode="derivatives"), published_at=datetime.utcnow() - timedelta(days=1))
    newer = _make_scenario(db, template_key="mathlab", config=dict(MATHLAB_CONFIG, mode="integrals"), published_at=datetime.utcnow())

    response = client.get("/gamification/game-scenarios/active/mathlab", headers=_student_header(user))
    assert response.status_code == 200
    assert response.json()["id"] == newer.id
