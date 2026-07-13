from tests.conftest import authorization_header


def test_content_manager_can_create_skill(client, content_manager_admin, subject):
    response = client.post(
        "/admin/skills/",
        headers=authorization_header(content_manager_admin),
        json={"name": "Chain rule", "code": "chain-rule", "subject_id": subject.id},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["code"] == "chain-rule"
    assert body["subject_id"] == subject.id
    assert body["is_active"] is True


def test_superadmin_can_create_skill(client, admin, subject):
    response = client.post(
        "/admin/skills/",
        headers=authorization_header(admin),
        json={"name": "Chain rule", "code": "chain-rule", "subject_id": subject.id},
    )

    assert response.status_code == 200


def test_teacher_cannot_create_skill(client, teacher_admin, subject):
    response = client.post(
        "/admin/skills/",
        headers=authorization_header(teacher_admin),
        json={"name": "Chain rule", "code": "chain-rule", "subject_id": subject.id},
    )

    assert response.status_code == 403


def test_unauthenticated_cannot_create_skill(client, subject):
    response = client.post(
        "/admin/skills/",
        json={"name": "Chain rule", "code": "chain-rule", "subject_id": subject.id},
    )

    assert response.status_code == 401


def test_teacher_can_list_skills(client, teacher_admin, content_manager_admin, subject):
    client.post(
        "/admin/skills/",
        headers=authorization_header(content_manager_admin),
        json={"name": "Chain rule", "code": "chain-rule", "subject_id": subject.id},
    )

    response = client.get("/admin/skills/", headers=authorization_header(teacher_admin))

    assert response.status_code == 200
    assert len(response.json()) == 1


def test_duplicate_code_in_same_subject_is_rejected(client, content_manager_admin, subject):
    payload = {"name": "Chain rule", "code": "chain-rule", "subject_id": subject.id}
    client.post("/admin/skills/", headers=authorization_header(content_manager_admin), json=payload)

    response = client.post(
        "/admin/skills/", headers=authorization_header(content_manager_admin), json=payload
    )

    assert response.status_code == 400


def test_same_code_allowed_in_different_subjects(client, content_manager_admin, subject, db):
    from app.models import Subject

    other_subject = Subject(name="Integrals", code="integrals")
    db.add(other_subject)
    db.commit()
    db.refresh(other_subject)

    headers = authorization_header(content_manager_admin)
    r1 = client.post(
        "/admin/skills/",
        headers=headers,
        json={"name": "Basics", "code": "basics", "subject_id": subject.id},
    )
    r2 = client.post(
        "/admin/skills/",
        headers=headers,
        json={"name": "Basics", "code": "basics", "subject_id": other_subject.id},
    )

    assert r1.status_code == 200
    assert r2.status_code == 200


def test_archive_skill_via_update(client, content_manager_admin, subject):
    headers = authorization_header(content_manager_admin)
    created = client.post(
        "/admin/skills/",
        headers=headers,
        json={"name": "Chain rule", "code": "chain-rule", "subject_id": subject.id},
    ).json()

    response = client.put(
        f"/admin/skills/{created['id']}",
        headers=headers,
        json={"is_active": False},
    )

    assert response.status_code == 200
    assert response.json()["is_active"] is False
    # архивация не меняет имя/код — обновились только переданные поля
    assert response.json()["code"] == "chain-rule"


def test_create_skill_for_missing_subject_returns_404(client, content_manager_admin):
    response = client.post(
        "/admin/skills/",
        headers=authorization_header(content_manager_admin),
        json={"name": "Chain rule", "code": "chain-rule", "subject_id": 999},
    )

    assert response.status_code == 404
