from tests.conftest import authorization_header


def test_successful_mutation_is_logged_with_actor(client, content_manager_admin, subject, db):
    from app.models import AuditLog

    response = client.post(
        "/admin/skills/",
        headers=authorization_header(content_manager_admin),
        json={"name": "Chain rule", "code": "chain-rule", "subject_id": subject.id},
    )
    assert response.status_code == 200

    entries = db.query(AuditLog).filter(AuditLog.path == "/admin/skills/").all()
    assert len(entries) == 1
    entry = entries[0]
    assert entry.actor_admin_id == content_manager_admin.id
    assert entry.actor_role == "content_manager"
    assert entry.method == "POST"
    assert entry.status_code == 200
    assert entry.entity_type == "skills"


def test_nested_action_path_is_parsed(client, content_manager_admin, teacher_admin, subject, db):
    from app.models import AuditLog

    task = client.post(
        "/admin/tasks",
        headers=authorization_header(content_manager_admin),
        json={"title": "Find the derivative", "subject": subject.code},
    ).json()

    client.post(f"/admin/tasks/{task['id']}/submit-review", headers=authorization_header(content_manager_admin))
    client.post(f"/admin/tasks/{task['id']}/approve", headers=authorization_header(teacher_admin))

    entry = (
        db.query(AuditLog)
        .filter(AuditLog.path == f"/admin/tasks/{task['id']}/approve")
        .one()
    )
    assert entry.entity_type == "tasks"
    assert entry.entity_id == str(task["id"])
    assert entry.action == "approve"
    assert entry.actor_role == "teacher"


def test_rejected_mutation_attempt_is_still_logged(client, teacher_admin, subject, db):
    from app.models import AuditLog

    response = client.post(
        "/admin/skills/",
        headers=authorization_header(teacher_admin),
        json={"name": "Chain rule", "code": "chain-rule", "subject_id": subject.id},
    )
    assert response.status_code == 403

    entry = db.query(AuditLog).filter(AuditLog.path == "/admin/skills/").one()
    assert entry.status_code == 403
    assert entry.actor_admin_id == teacher_admin.id


def test_unauthenticated_mutation_attempt_logged_with_no_actor(client, subject, db):
    from app.models import AuditLog

    response = client.post(
        "/admin/skills/",
        json={"name": "Chain rule", "code": "chain-rule", "subject_id": subject.id},
    )
    assert response.status_code == 401

    entry = db.query(AuditLog).filter(AuditLog.path == "/admin/skills/").one()
    assert entry.actor_admin_id is None
    assert entry.actor_role is None


def test_get_requests_are_not_audited(client, admin, db):
    from app.models import AuditLog

    client.get("/admin/skills/", headers=authorization_header(admin))

    assert db.query(AuditLog).filter(AuditLog.path == "/admin/skills/").count() == 0


def test_non_admin_mutations_are_not_audited(client, user, db):
    from app.auth import create_access_token
    from app.models import AuditLog

    token = create_access_token({"sub": user.email})
    client.cookies.set("token", token)
    csrf_token = client.get("/api/me").headers["x-csrf-token"]

    client.put(
        "/api/me/update",
        headers={"X-CSRF-Token": csrf_token},
        json={"username": "renamed"},
    )

    assert db.query(AuditLog).filter(AuditLog.path == "/api/me/update").count() == 0
