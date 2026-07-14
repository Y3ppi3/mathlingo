"""
R3 task 8: полный E2E-прогон "создать конфиг -> предпросмотр -> чек-лист ->
публикация -> игра проходится учеником -> попытка попадает в attempts и
видна на dashboard" (см. docs/roadmap/product-technical-plan.md R3 §6),
впервые формализованный как автоматизация, а не только ручной чек-лист.
Прогоняется по всем трём шаблонам — миграция на конфиг (R3 задачи 3-4)
должна была сделать их поведение единообразным.
"""
import pytest

from app.models import Attempt, MasteryState, Skill
from tests.conftest import authorization_header

CHECKLIST_ITEMS = ("texts_correct", "no_placeholders", "katex_renders")


def _config_for(template_key: str) -> dict:
    if template_key == "derivfall":
        return {
            "difficulty": 3, "time_limit": 60,
            "problems": [{"id": "d1", "problem": "(x^2)'", "options": ["2x", "x"], "answer": "2x", "difficulty": "easy"}],
        }
    if template_key == "integralbuilder":
        return {
            "initial_difficulty": 3, "time_limit": 300,
            "problems": [{"id": "i1", "question": "∫ x dx", "solution_pieces": ["x²/2", "+C"], "distractors": [], "difficulty": "easy"}],
        }
    return {
        "mode": "derivatives", "difficulty": 3,
        "tasks": [{"id": "t1", "type": "calculate", "question": "q", "function_expression": "x^2", "correct_answer": "2x", "difficulty": 3, "hints": []}],
    }


def _active_endpoint_params(template_key: str) -> dict:
    if template_key == "mathlab":
        return {"mode": "derivatives"}
    return {}


def _student_header(user):
    from app.auth import create_access_token

    token = create_access_token({"sub": user.email})
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.parametrize("template_key", ["derivfall", "integralbuilder", "mathlab"])
def test_full_scenario_lifecycle(client, db, content_manager_admin, user, subject, template_key):
    skill = Skill(subject_id=subject.id, name="E2E skill", code=f"e2e-{template_key}")
    db.add(skill)
    db.commit()
    db.refresh(skill)

    admin_headers = authorization_header(content_manager_admin)

    # 1. Создать конфиг (draft).
    create = client.post(
        "/admin/game-scenarios/",
        headers=admin_headers,
        json={"template_key": template_key, "config": _config_for(template_key), "skill_id": skill.id},
    )
    assert create.status_code == 200, create.text
    scenario_id = create.json()["id"]
    assert create.json()["status"] == "draft"

    # 2. Чек-лист.
    for item in CHECKLIST_ITEMS:
        r = client.post(f"/admin/game-scenarios/{scenario_id}/checklist/{item}", headers=admin_headers)
        assert r.status_code == 200

    # 3. Предпросмотр.
    preview = client.post(f"/admin/game-scenarios/{scenario_id}/preview", headers=admin_headers)
    assert preview.status_code == 200
    assert preview.json()["preview_passed_at"] is not None

    # 4. Публикация.
    publish = client.post(f"/admin/game-scenarios/{scenario_id}/publish", headers=admin_headers)
    assert publish.status_code == 200
    assert publish.json()["status"] == "published"

    # 5. Ученик получает активный сценарий шаблона.
    student_headers = _student_header(user)
    active = client.get(f"/gamification/game-scenarios/active/{template_key}", headers=student_headers, params=_active_endpoint_params(template_key))
    assert active.status_code == 200
    assert active.json()["id"] == scenario_id

    # 6. Ученик проходит игру -> попытка.
    submit = client.post(
        f"/gamification/game-scenarios/{scenario_id}/submit-attempt",
        headers=student_headers,
        json={"score": 90, "max_score": 100, "time_spent_ms": 20000},
    )
    assert submit.status_code == 200
    assert submit.json()["is_correct"] is True

    attempt = db.query(Attempt).filter(Attempt.content_type == "game", Attempt.content_id == scenario_id).first()
    assert attempt is not None
    assert attempt.skill_id == skill.id

    mastery_state = db.query(MasteryState).filter(MasteryState.user_id == user.id, MasteryState.skill_id == skill.id).first()
    assert mastery_state is not None
    assert mastery_state.sample_size == 1

    # 7. Виден на dashboard.
    dashboard_response = client.get("/admin/dashboard/overview", headers=admin_headers)
    assert dashboard_response.status_code == 200
    dashboard_body = dashboard_response.json()

    completion_entry = next((g for g in dashboard_body["game_completion"] if g["template_key"] == template_key), None)
    assert completion_entry is not None
    assert completion_entry["sessions"] >= 1

    skill_entry = next((s for s in dashboard_body["skill_progress"] if s["skill_id"] == skill.id), None)
    assert skill_entry is not None
    assert skill_entry["student_count"] >= 1
