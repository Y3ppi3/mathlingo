"""
R1 task 7: закрывает пробелы в RBAC-покрытии, обнаруженные при аудите —
subjects/admin_gamification/legacy tasks.py эндпоинты изначально были
гейтованы только `get_admin_current_user` (любая роль), в отличие от
tasks/skills, которые с самого начала строились с require_role().
"""
from tests.conftest import authorization_header


# --- /admin/subjects ---

def test_teacher_cannot_create_subject(client, teacher_admin):
    response = client.post(
        "/admin/subjects",
        headers=authorization_header(teacher_admin),
        json={"name": "Algebra", "code": "algebra"},
    )
    assert response.status_code == 403


def test_content_manager_can_create_subject(client, content_manager_admin):
    response = client.post(
        "/admin/subjects",
        headers=authorization_header(content_manager_admin),
        json={"name": "Algebra", "code": "algebra"},
    )
    assert response.status_code == 200


def test_content_manager_cannot_hard_delete_subject(client, content_manager_admin, subject):
    response = client.delete(
        f"/admin/subjects/{subject.id}",
        headers=authorization_header(content_manager_admin),
    )
    assert response.status_code == 403


def test_superadmin_can_hard_delete_subject(client, admin, subject):
    response = client.delete(
        f"/admin/subjects/{subject.id}",
        headers=authorization_header(admin),
    )
    assert response.status_code == 204


def test_teacher_cannot_update_subject(client, teacher_admin, subject):
    response = client.put(
        f"/admin/subjects/{subject.id}",
        headers=authorization_header(teacher_admin),
        json={"name": "Renamed"},
    )
    assert response.status_code == 403


# --- /admin/gamification (maps/locations/task-groups/achievements) ---

def test_teacher_cannot_create_adventure_map(client, teacher_admin, subject):
    response = client.post(
        "/admin/gamification/maps",
        headers=authorization_header(teacher_admin),
        json={"name": "Map", "subject_id": subject.id},
    )
    assert response.status_code == 403


def test_content_manager_can_create_adventure_map(client, content_manager_admin, subject):
    response = client.post(
        "/admin/gamification/maps",
        headers=authorization_header(content_manager_admin),
        json={"name": "Map", "subject_id": subject.id},
    )
    assert response.status_code == 200


def test_content_manager_cannot_delete_adventure_map(client, content_manager_admin, subject):
    created = client.post(
        "/admin/gamification/maps",
        headers=authorization_header(content_manager_admin),
        json={"name": "Map", "subject_id": subject.id},
    ).json()

    response = client.delete(
        f"/admin/gamification/maps/{created['id']}",
        headers=authorization_header(content_manager_admin),
    )
    assert response.status_code == 403


def test_superadmin_can_delete_adventure_map(client, admin, subject):
    created = client.post(
        "/admin/gamification/maps",
        headers=authorization_header(admin),
        json={"name": "Map", "subject_id": subject.id},
    ).json()

    response = client.delete(
        f"/admin/gamification/maps/{created['id']}",
        headers=authorization_header(admin),
    )
    assert response.status_code == 200


def test_teacher_cannot_create_achievement(client, teacher_admin):
    response = client.post(
        "/admin/gamification/achievements",
        headers=authorization_header(teacher_admin),
        json={"name": "x", "description": "x", "icon_url": "x", "unlock_condition": {}},
    )
    assert response.status_code == 403


def test_content_manager_cannot_delete_achievement(client, content_manager_admin):
    created = client.post(
        "/admin/gamification/achievements",
        headers=authorization_header(content_manager_admin),
        json={"name": "x", "description": "x", "icon_url": "x", "unlock_condition": {}},
    ).json()

    response = client.delete(
        f"/admin/gamification/achievements/{created['id']}",
        headers=authorization_header(content_manager_admin),
    )
    assert response.status_code == 403


# --- legacy /api/tasks/ (app/routes/tasks.py, separate from /admin/tasks) ---

def test_teacher_cannot_create_task_via_legacy_api_endpoint(client, teacher_admin):
    response = client.post(
        "/api/tasks/",
        headers=authorization_header(teacher_admin),
        json={"title": "x", "subject": "algebra"},
    )
    assert response.status_code == 403


def test_content_manager_can_create_task_via_legacy_api_endpoint(client, content_manager_admin):
    response = client.post(
        "/api/tasks/",
        headers=authorization_header(content_manager_admin),
        json={"title": "x", "subject": "algebra"},
    )
    assert response.status_code == 200
