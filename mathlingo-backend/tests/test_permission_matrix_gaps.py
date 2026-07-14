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


# Ранее в admin.py существовало два конкурирующих @router.delete("/subjects/{subject_id}")
# — второй (с поддержкой force) был мёртвым кодом: FastAPI матчит первый
# зарегистрированный роут, поэтому force=true никогда не выполнял каскадное
# удаление, хотя фронтенд (adminApi.ts deleteSubject) на это рассчитывал.
# Слиты в один эндпоинт (R4) — эти тесты закрывают оба ветвления.
def test_delete_subject_with_tasks_requires_force(client, admin, content_manager_admin, subject):
    create = client.post(
        "/admin/tasks",
        headers=authorization_header(content_manager_admin),
        json={"title": "Find the derivative", "subject": subject.code},
    )
    assert create.status_code == 200, create.text

    response = client.delete(
        f"/admin/subjects/{subject.id}",
        headers=authorization_header(admin),
    )
    assert response.status_code == 400
    body = response.json()
    assert body["status"] == "confirmation_required"
    assert body["related_data"]["tasks_count"] == 1


def test_delete_subject_with_force_unlinks_tasks_and_deletes(client, admin, content_manager_admin, subject, db):
    from app.models import Subject as SubjectModel, Task as TaskModel

    create = client.post(
        "/admin/tasks",
        headers=authorization_header(content_manager_admin),
        json={"title": "Find the derivative", "subject": subject.code},
    )
    assert create.status_code == 200, create.text
    task_id = create.json()["id"]

    response = client.delete(
        f"/admin/subjects/{subject.id}?force=true",
        headers=authorization_header(admin),
    )
    assert response.status_code == 204

    # Задание не удаляется вместе с разделом — только отвязывается
    # (subject_id=None).
    db_task = db.query(TaskModel).filter(TaskModel.id == task_id).first()
    assert db_task is not None
    assert db_task.subject_id is None

    assert db.query(SubjectModel).filter(SubjectModel.id == subject.id).first() is None


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
