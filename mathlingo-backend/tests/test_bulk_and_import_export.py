import io

from tests.conftest import authorization_header


def _create_draft_task(client, content_manager_admin, subject, title="Find the derivative"):
    response = client.post(
        "/admin/tasks",
        headers=authorization_header(content_manager_admin),
        json={"title": title, "subject": subject.code},
    )
    assert response.status_code == 200
    return response.json()


def test_bulk_action_reports_partial_success(client, content_manager_admin, teacher_admin, subject):
    in_review_task = _create_draft_task(client, content_manager_admin, subject, "In review task")
    draft_task = _create_draft_task(client, content_manager_admin, subject, "Still draft task")

    client.post(
        f"/admin/tasks/{in_review_task['id']}/submit-review",
        headers=authorization_header(content_manager_admin),
    )

    response = client.post(
        "/admin/tasks/bulk",
        headers=authorization_header(teacher_admin),
        json={"ids": [in_review_task["id"], draft_task["id"]], "action": "approve"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["succeeded"] == [in_review_task["id"]]
    assert len(body["failed"]) == 1
    assert body["failed"][0]["id"] == draft_task["id"]


def test_bulk_action_enforces_role_per_item(client, content_manager_admin, subject):
    task = _create_draft_task(client, content_manager_admin, subject)
    client.post(f"/admin/tasks/{task['id']}/submit-review", headers=authorization_header(content_manager_admin))

    # content_manager не может approve — даже через bulk (та же роль-проверка,
    # что и у одиночного /approve)
    response = client.post(
        "/admin/tasks/bulk",
        headers=authorization_header(content_manager_admin),
        json={"ids": [task["id"]], "action": "approve"},
    )

    assert response.status_code == 200
    assert response.json()["succeeded"] == []
    assert response.json()["failed"][0]["id"] == task["id"]


def test_export_json_contains_created_task(client, content_manager_admin, subject):
    task = _create_draft_task(client, content_manager_admin, subject)

    response = client.get("/admin/tasks/export", headers=authorization_header(content_manager_admin))

    assert response.status_code == 200
    ids = [row["id"] for row in response.json()]
    assert task["id"] in ids


def test_export_csv_returns_csv_content_type(client, admin, subject):
    _create_draft_task(client, admin, subject)

    response = client.get(
        "/admin/tasks/export", params={"format": "csv"}, headers=authorization_header(admin)
    )

    assert response.status_code == 200
    assert "text/csv" in response.headers["content-type"]
    assert "title" in response.text


def test_export_rejects_unknown_format(client, admin):
    response = client.get(
        "/admin/tasks/export", params={"format": "xml"}, headers=authorization_header(admin)
    )

    assert response.status_code == 400


def test_import_json_partial_success_on_invalid_row(client, content_manager_admin, subject):
    response = client.post(
        "/admin/tasks/import",
        headers=authorization_header(content_manager_admin),
        json={"rows": [
            {"title": "Valid row", "subject": subject.code},
            {"description": "missing required title/subject"},
        ]},
    )

    assert response.status_code == 200
    body = response.json()
    assert len(body["created"]) == 1
    assert len(body["failed"]) == 1
    assert body["failed"][0]["row"] == 1


def test_import_json_requires_content_manage_role(client, teacher_admin, subject):
    response = client.post(
        "/admin/tasks/import",
        headers=authorization_header(teacher_admin),
        json={"rows": [{"title": "x", "subject": subject.code}]},
    )

    assert response.status_code == 403


def test_import_json_created_tasks_start_as_draft(client, content_manager_admin, subject):
    response = client.post(
        "/admin/tasks/import",
        headers=authorization_header(content_manager_admin),
        json={"rows": [{"title": "Imported task", "subject": subject.code}]},
    )
    task_id = response.json()["created"][0]

    fetched = client.get("/admin/tasks/export", headers=authorization_header(content_manager_admin)).json()
    imported = next(t for t in fetched if t["id"] == task_id)
    assert imported["status"] == "draft"
    assert imported["source"] == "manual"


def test_import_csv_creates_tasks(client, content_manager_admin, subject):
    csv_content = f"title,subject\r\nCSV imported task,{subject.code}\r\n"
    response = client.post(
        "/admin/tasks/import-csv",
        headers=authorization_header(content_manager_admin),
        files={"file": ("tasks.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")},
    )

    assert response.status_code == 200
    body = response.json()
    assert len(body["created"]) == 1
    assert body["failed"] == []


def test_bulk_user_status_requires_superadmin(client, content_manager_admin, user):
    response = client.post(
        "/admin/users/bulk-status",
        headers=authorization_header(content_manager_admin),
        json={"ids": [user.id], "is_active": False},
    )

    assert response.status_code == 403


def test_bulk_user_status_updates_multiple_users(client, admin, db):
    from app.models import User
    from app.auth import hash_password

    u1 = User(username="u1", email="u1@example.com", hashed_password=hash_password("password123"))
    u2 = User(username="u2", email="u2@example.com", hashed_password=hash_password("password123"))
    db.add_all([u1, u2])
    db.commit()
    db.refresh(u1)
    db.refresh(u2)

    response = client.post(
        "/admin/users/bulk-status",
        headers=authorization_header(admin),
        json={"ids": [u1.id, u2.id], "is_active": False},
    )

    assert response.status_code == 200
    assert response.json()["updated_count"] == 2

    db.refresh(u1)
    db.refresh(u2)
    assert u1.is_active is False
    assert u2.is_active is False
