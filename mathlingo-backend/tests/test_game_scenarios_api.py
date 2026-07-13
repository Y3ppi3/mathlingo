"""
HTTP/RBAC-тесты игровых сценариев (R3 task 2): CRUD, чек-лист, preview-гейт
и его staleness-проверка при повторном редактировании после прохождения
чек-листа/preview (см. app/routes/game_scenarios.py _check_publish_gate).
"""
from tests.conftest import authorization_header

VALID_DERIVFALL_CONFIG = {
    "difficulty": 3,
    "time_limit": 60,
    "problems": [
        {"id": "d1", "problem": "(x^2)'", "options": ["2x", "x", "2", "x^2"], "answer": "2x", "difficulty": "easy"},
    ],
}

CHECKLIST_ITEMS = ("texts_correct", "no_placeholders", "katex_renders")


def _create_scenario(client, admin, config=None):
    return client.post(
        "/admin/game-scenarios/",
        headers=authorization_header(admin),
        json={"template_key": "derivfall", "config": config or VALID_DERIVFALL_CONFIG},
    )


def _pass_checklist_and_preview(client, admin, scenario_id):
    for item in CHECKLIST_ITEMS:
        r = client.post(f"/admin/game-scenarios/{scenario_id}/checklist/{item}", headers=authorization_header(admin))
        assert r.status_code == 200
    r = client.post(f"/admin/game-scenarios/{scenario_id}/preview", headers=authorization_header(admin))
    assert r.status_code == 200


# --- CRUD + RBAC ---

def test_content_manager_can_create_scenario(client, content_manager_admin):
    response = _create_scenario(client, content_manager_admin)
    assert response.status_code == 200
    body = response.json()
    assert body["template_key"] == "derivfall"
    assert body["status"] == "draft"
    assert body["created_by_admin_id"] == content_manager_admin.id


def test_teacher_cannot_create_scenario(client, teacher_admin):
    response = _create_scenario(client, teacher_admin)
    assert response.status_code == 403


def test_create_with_invalid_config_returns_422(client, content_manager_admin):
    bad_config = dict(VALID_DERIVFALL_CONFIG)
    bad_config["problems"] = []
    response = _create_scenario(client, content_manager_admin, config=bad_config)
    assert response.status_code == 422


def test_teacher_can_list_and_get_scenario(client, content_manager_admin, teacher_admin):
    scenario_id = _create_scenario(client, content_manager_admin).json()["id"]

    listed = client.get("/admin/game-scenarios/", headers=authorization_header(teacher_admin))
    assert listed.status_code == 200
    assert any(s["id"] == scenario_id for s in listed.json())

    got = client.get(f"/admin/game-scenarios/{scenario_id}", headers=authorization_header(teacher_admin))
    assert got.status_code == 200


def test_list_requires_authentication(client):
    response = client.get("/admin/game-scenarios/")
    assert response.status_code == 401


def test_get_missing_scenario_404(client, content_manager_admin):
    response = client.get("/admin/game-scenarios/999999", headers=authorization_header(content_manager_admin))
    assert response.status_code == 404


def test_update_while_draft_succeeds_and_resets_preview(client, content_manager_admin):
    scenario_id = _create_scenario(client, content_manager_admin).json()["id"]
    client.post(f"/admin/game-scenarios/{scenario_id}/preview", headers=authorization_header(content_manager_admin))

    updated_config = dict(VALID_DERIVFALL_CONFIG)
    updated_config["time_limit"] = 90
    response = client.put(
        f"/admin/game-scenarios/{scenario_id}",
        headers=authorization_header(content_manager_admin),
        json={"config": updated_config},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["config"]["time_limit"] == 90
    assert body["preview_passed_at"] is None


def test_teacher_cannot_update_scenario(client, content_manager_admin, teacher_admin):
    scenario_id = _create_scenario(client, content_manager_admin).json()["id"]
    response = client.put(
        f"/admin/game-scenarios/{scenario_id}",
        headers=authorization_header(teacher_admin),
        json={"level_range": [1, 3]},
    )
    assert response.status_code == 403


# --- Чек-лист ---

def test_teacher_can_check_checklist_item_but_not_publish(client, content_manager_admin, teacher_admin):
    scenario_id = _create_scenario(client, content_manager_admin).json()["id"]

    response = client.post(
        f"/admin/game-scenarios/{scenario_id}/checklist/texts_correct",
        headers=authorization_header(teacher_admin),
    )
    assert response.status_code == 200
    assert response.json()["checked_by_admin_id"] == teacher_admin.id

    publish = client.post(f"/admin/game-scenarios/{scenario_id}/publish", headers=authorization_header(teacher_admin))
    assert publish.status_code == 403


def test_unknown_checklist_item_rejected(client, content_manager_admin):
    scenario_id = _create_scenario(client, content_manager_admin).json()["id"]
    response = client.post(
        f"/admin/game-scenarios/{scenario_id}/checklist/not-a-real-item",
        headers=authorization_header(content_manager_admin),
    )
    assert response.status_code == 400


def test_get_checklist_lists_all_items_with_unchecked_nulls(client, content_manager_admin):
    scenario_id = _create_scenario(client, content_manager_admin).json()["id"]
    client.post(f"/admin/game-scenarios/{scenario_id}/checklist/texts_correct", headers=authorization_header(content_manager_admin))

    response = client.get(f"/admin/game-scenarios/{scenario_id}/checklist", headers=authorization_header(content_manager_admin))
    assert response.status_code == 200
    items = {row["item_key"]: row for row in response.json()}
    assert set(items.keys()) == set(CHECKLIST_ITEMS)
    assert items["texts_correct"]["checked_at"] is not None
    assert items["no_placeholders"]["checked_at"] is None


# --- Preview + publish gate ---

def test_publish_without_checklist_or_preview_blocked(client, content_manager_admin):
    scenario_id = _create_scenario(client, content_manager_admin).json()["id"]
    response = client.post(f"/admin/game-scenarios/{scenario_id}/publish", headers=authorization_header(content_manager_admin))
    assert response.status_code == 409


def test_publish_with_checklist_but_no_preview_blocked(client, content_manager_admin):
    scenario_id = _create_scenario(client, content_manager_admin).json()["id"]
    for item in CHECKLIST_ITEMS:
        client.post(f"/admin/game-scenarios/{scenario_id}/checklist/{item}", headers=authorization_header(content_manager_admin))

    response = client.post(f"/admin/game-scenarios/{scenario_id}/publish", headers=authorization_header(content_manager_admin))
    assert response.status_code == 409


def test_full_publish_happy_path(client, content_manager_admin):
    scenario_id = _create_scenario(client, content_manager_admin).json()["id"]
    _pass_checklist_and_preview(client, content_manager_admin, scenario_id)

    response = client.post(f"/admin/game-scenarios/{scenario_id}/publish", headers=authorization_header(content_manager_admin))
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "published"
    assert body["published_at"] is not None


def test_publish_blocked_after_edit_invalidates_stale_checklist(client, content_manager_admin):
    """
    Чек-лист/preview пройдены -> конфиг отредактирован -> публикация должна
    требовать повторного прохождения (staleness-гейт), а не пропускать по
    старым отметкам.
    """
    scenario_id = _create_scenario(client, content_manager_admin).json()["id"]
    _pass_checklist_and_preview(client, content_manager_admin, scenario_id)

    updated_config = dict(VALID_DERIVFALL_CONFIG)
    updated_config["time_limit"] = 120
    client.put(
        f"/admin/game-scenarios/{scenario_id}",
        headers=authorization_header(content_manager_admin),
        json={"config": updated_config},
    )

    response = client.post(f"/admin/game-scenarios/{scenario_id}/publish", headers=authorization_header(content_manager_admin))
    assert response.status_code == 409

    # После повторного прохождения — публикация проходит.
    _pass_checklist_and_preview(client, content_manager_admin, scenario_id)
    response2 = client.post(f"/admin/game-scenarios/{scenario_id}/publish", headers=authorization_header(content_manager_admin))
    assert response2.status_code == 200


def test_published_scenario_cannot_be_edited_directly(client, content_manager_admin):
    scenario_id = _create_scenario(client, content_manager_admin).json()["id"]
    _pass_checklist_and_preview(client, content_manager_admin, scenario_id)
    client.post(f"/admin/game-scenarios/{scenario_id}/publish", headers=authorization_header(content_manager_admin))

    response = client.put(
        f"/admin/game-scenarios/{scenario_id}",
        headers=authorization_header(content_manager_admin),
        json={"level_range": [2, 4]},
    )
    assert response.status_code == 409


# --- Архивация ---

def test_archive_draft_scenario(client, content_manager_admin):
    scenario_id = _create_scenario(client, content_manager_admin).json()["id"]
    response = client.post(f"/admin/game-scenarios/{scenario_id}/archive", headers=authorization_header(content_manager_admin))
    assert response.status_code == 200
    assert response.json()["status"] == "archived"


def test_archive_published_scenario(client, content_manager_admin):
    scenario_id = _create_scenario(client, content_manager_admin).json()["id"]
    _pass_checklist_and_preview(client, content_manager_admin, scenario_id)
    client.post(f"/admin/game-scenarios/{scenario_id}/publish", headers=authorization_header(content_manager_admin))

    response = client.post(f"/admin/game-scenarios/{scenario_id}/archive", headers=authorization_header(content_manager_admin))
    assert response.status_code == 200
    assert response.json()["status"] == "archived"


def test_cannot_archive_already_archived_scenario(client, content_manager_admin):
    scenario_id = _create_scenario(client, content_manager_admin).json()["id"]
    client.post(f"/admin/game-scenarios/{scenario_id}/archive", headers=authorization_header(content_manager_admin))

    response = client.post(f"/admin/game-scenarios/{scenario_id}/archive", headers=authorization_header(content_manager_admin))
    assert response.status_code == 409


def test_teacher_cannot_archive_scenario(client, content_manager_admin, teacher_admin):
    scenario_id = _create_scenario(client, content_manager_admin).json()["id"]
    response = client.post(f"/admin/game-scenarios/{scenario_id}/archive", headers=authorization_header(teacher_admin))
    assert response.status_code == 403
