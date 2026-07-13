from tests.conftest import authorization_header


def test_only_superadmin_can_list_admins(client, admin, content_manager_admin):
    denied = client.get("/admin/admins", headers=authorization_header(content_manager_admin))
    assert denied.status_code == 403

    allowed = client.get("/admin/admins", headers=authorization_header(admin))
    assert allowed.status_code == 200
    emails = [a["email"] for a in allowed.json()]
    assert admin.email in emails
    assert content_manager_admin.email in emails
    assert "token" not in allowed.json()[0]


def test_teacher_cannot_view_audit_log(client, teacher_admin):
    response = client.get("/admin/audit-log", headers=authorization_header(teacher_admin))
    assert response.status_code == 403


def test_superadmin_sees_all_audit_entries(client, admin, content_manager_admin, subject):
    client.post(
        "/admin/skills/",
        headers=authorization_header(content_manager_admin),
        json={"name": "Chain rule", "code": "chain-rule", "subject_id": subject.id},
    )

    response = client.get("/admin/audit-log", headers=authorization_header(admin))

    assert response.status_code == 200
    actors = {e["actor_admin_id"] for e in response.json()}
    assert content_manager_admin.id in actors


def test_content_manager_sees_only_own_audit_entries(client, admin, content_manager_admin, subject):
    # действие суперадмина
    client.post(
        "/admin/skills/",
        headers=authorization_header(admin),
        json={"name": "Basics", "code": "basics", "subject_id": subject.id},
    )
    # действие content_manager
    client.post(
        "/admin/skills/",
        headers=authorization_header(content_manager_admin),
        json={"name": "Chain rule", "code": "chain-rule", "subject_id": subject.id},
    )

    response = client.get("/admin/audit-log", headers=authorization_header(content_manager_admin))

    assert response.status_code == 200
    actors = {e["actor_admin_id"] for e in response.json()}
    assert actors == {content_manager_admin.id}


def test_content_manager_cannot_query_other_actor_id(client, admin, content_manager_admin):
    response = client.get(
        "/admin/audit-log",
        params={"actor_admin_id": admin.id},
        headers=authorization_header(content_manager_admin),
    )
    assert response.status_code == 403


def test_audit_log_filters_by_entity_type(client, admin, content_manager_admin, subject):
    client.post(
        "/admin/skills/",
        headers=authorization_header(content_manager_admin),
        json={"name": "Chain rule", "code": "chain-rule", "subject_id": subject.id},
    )
    client.post(
        "/admin/tasks",
        headers=authorization_header(content_manager_admin),
        json={"title": "x", "subject": subject.code},
    )

    response = client.get(
        "/admin/audit-log",
        params={"entity_type": "skills"},
        headers=authorization_header(admin),
    )

    assert response.status_code == 200
    assert all(e["entity_type"] == "skills" for e in response.json())
    assert len(response.json()) >= 1
