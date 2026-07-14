# tests/test_caching.py
"""
R4: покрывает главный риск кеширования — не "работает ли Redis", а
"не отдаёт ли кеш устаревшие или чужие данные". Три сценария:
1. инвалидация при publish/archive активного игрового сценария;
2. dashboard/overview не путает кеш между ролями (teacher не должен
   получить закешированный ответ superadmin с admin_actions);
3. инвалидация списков subjects/skills при мутациях.
"""
from app.services import cache
from tests.conftest import authorization_header
from tests.test_game_scenarios_api import CHECKLIST_ITEMS, _create_scenario, _pass_checklist_and_preview


def _student_header(user):
    from app.auth import create_access_token

    token = create_access_token({"sub": user.email})
    return {"Authorization": f"Bearer {token}"}


def test_active_game_scenario_is_served_from_cache_on_second_request(client, content_manager_admin, user):
    scenario_id = _create_scenario(client, content_manager_admin).json()["id"]
    _pass_checklist_and_preview(client, content_manager_admin, scenario_id)
    client.post(f"/admin/game-scenarios/{scenario_id}/publish", headers=authorization_header(content_manager_admin))

    student_headers = _student_header(user)
    first = client.get("/gamification/game-scenarios/active/derivfall", headers=student_headers)
    assert first.status_code == 200
    assert cache.get_json("game_scenario_active:derivfall:_") is not None

    second = client.get("/gamification/game-scenarios/active/derivfall", headers=student_headers)
    assert second.status_code == 200
    assert second.json() == first.json()


def test_active_game_scenario_cache_invalidated_on_republish(client, content_manager_admin, user):
    """
    Публикуем сценарий A, читаем его (кеш прогрет), архивируем A и
    публикуем B — следующий GET должен вернуть B, а не закешированный A.
    Это ровно тот риск, который делает TTL-без-инвалидации неприемлемым
    для этого эндпоинта (см. docs/roadmap/product-technical-plan.md, R4 §3).
    """
    config_a = {
        "difficulty": 3, "time_limit": 60,
        "problems": [{"id": "a1", "problem": "(x^2)'", "options": ["2x", "x"], "answer": "2x", "difficulty": "easy"}],
    }
    config_b = {
        "difficulty": 4, "time_limit": 90,
        "problems": [{"id": "b1", "problem": "(x^3)'", "options": ["3x^2", "x"], "answer": "3x^2", "difficulty": "easy"}],
    }

    scenario_a = _create_scenario(client, content_manager_admin, config=config_a).json()["id"]
    _pass_checklist_and_preview(client, content_manager_admin, scenario_a)
    client.post(f"/admin/game-scenarios/{scenario_a}/publish", headers=authorization_header(content_manager_admin))

    student_headers = _student_header(user)
    first = client.get("/gamification/game-scenarios/active/derivfall", headers=student_headers)
    assert first.json()["id"] == scenario_a

    client.post(f"/admin/game-scenarios/{scenario_a}/archive", headers=authorization_header(content_manager_admin))

    scenario_b = _create_scenario(client, content_manager_admin, config=config_b).json()["id"]
    _pass_checklist_and_preview(client, content_manager_admin, scenario_b)
    client.post(f"/admin/game-scenarios/{scenario_b}/publish", headers=authorization_header(content_manager_admin))

    second = client.get("/gamification/game-scenarios/active/derivfall", headers=student_headers)
    assert second.json()["id"] == scenario_b


def test_dashboard_overview_cache_does_not_leak_admin_actions_to_teacher(client, admin, teacher_admin):
    """
    Ключ кеша обязан учитывать include_admin_actions — иначе ответ,
    закешированный для superadmin (с admin_actions), мог бы отдаться
    teacher'у, которому эти данные видеть нельзя (см. R3 §5).
    """
    superadmin_response = client.get("/admin/dashboard/overview", headers=authorization_header(admin))
    assert superadmin_response.status_code == 200
    assert superadmin_response.json()["admin_actions"] is not None

    teacher_response = client.get("/admin/dashboard/overview", headers=authorization_header(teacher_admin))
    assert teacher_response.status_code == 200
    assert teacher_response.json()["admin_actions"] is None


def test_dashboard_overview_is_cached(client, admin):
    first = client.get("/admin/dashboard/overview", headers=authorization_header(admin))
    assert first.status_code == 200
    assert cache.get_json("dashboard_overview:full") is not None

    second = client.get("/admin/dashboard/overview", headers=authorization_header(admin))
    assert second.json() == first.json()


def test_subjects_list_cache_invalidated_on_create(client, content_manager_admin):
    before = client.get("/api/subjects/")
    assert before.status_code == 200
    names_before = {s["name"] for s in before.json()}
    assert "New Cached Subject" not in names_before

    create = client.post(
        "/admin/subjects",
        headers=authorization_header(content_manager_admin),
        json={"name": "New Cached Subject", "code": "new-cached-subject"},
    )
    assert create.status_code == 200

    after = client.get("/api/subjects/")
    names_after = {s["name"] for s in after.json()}
    assert "New Cached Subject" in names_after


def test_skills_list_cache_invalidated_on_update(client, content_manager_admin, subject):
    create = client.post(
        "/admin/skills/",
        headers=authorization_header(content_manager_admin),
        json={"subject_id": subject.id, "name": "Original", "code": "original-skill"},
    )
    assert create.status_code == 200
    skill_id = create.json()["id"]

    listed = client.get("/admin/skills/", headers=authorization_header(content_manager_admin))
    assert any(s["id"] == skill_id and s["name"] == "Original" for s in listed.json())

    update = client.put(
        f"/admin/skills/{skill_id}",
        headers=authorization_header(content_manager_admin),
        json={"name": "Renamed"},
    )
    assert update.status_code == 200

    listed_again = client.get("/admin/skills/", headers=authorization_header(content_manager_admin))
    renamed = next(s for s in listed_again.json() if s["id"] == skill_id)
    assert renamed["name"] == "Renamed"
