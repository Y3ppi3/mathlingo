from app.auth import create_access_token


def authorization_header(admin):
    token = create_access_token({"sub": admin.email, "role": "admin"})
    return {"Authorization": f"Bearer {token}"}


def test_first_admin_can_be_registered_without_authentication(client):
    response = client.post(
        "/admin/register",
        json={
            "username": "first-admin",
            "email": "admin@example.com",
            "password": "password123",
        },
    )

    assert response.status_code == 200
    assert response.json()["email"] == "admin@example.com"
    assert response.json()["token"]


def test_admin_registration_requires_existing_admin(client, admin):
    response = client.post(
        "/admin/register",
        json={
            "username": "second-admin",
            "email": "second@example.com",
            "password": "password123",
        },
    )

    assert response.status_code == 403


def test_authenticated_admin_can_register_another_admin(client, admin):
    response = client.post(
        "/admin/register",
        headers=authorization_header(admin),
        json={
            "username": "second-admin",
            "email": "second@example.com",
            "password": "password123",
            "role": "content_manager",
        },
    )

    assert response.status_code == 200
    assert response.json()["email"] == "second@example.com"
    assert response.json()["role"] == "content_manager"


def test_registering_admin_without_role_is_rejected(client, admin):
    response = client.post(
        "/admin/register",
        headers=authorization_header(admin),
        json={
            "username": "second-admin",
            "email": "second@example.com",
            "password": "password123",
        },
    )

    assert response.status_code == 400


def test_non_superadmin_cannot_register_new_admin(client, content_manager_admin):
    response = client.post(
        "/admin/register",
        headers=authorization_header(content_manager_admin),
        json={
            "username": "second-admin",
            "email": "second@example.com",
            "password": "password123",
            "role": "teacher",
        },
    )

    assert response.status_code == 403


def test_first_admin_is_always_superadmin_regardless_of_requested_role(client):
    response = client.post(
        "/admin/register",
        json={
            "username": "first-admin",
            "email": "admin@example.com",
            "password": "password123",
            "role": "teacher",
        },
    )

    assert response.status_code == 200
    assert response.json()["role"] == "superadmin"


def test_admin_endpoints_reject_regular_user_token(client, user):
    token = create_access_token({"sub": user.email})
    response = client.get("/admin/users", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 403


def test_admin_endpoints_accept_admin_bearer_token(client, admin):
    response = client.get("/admin/users", headers=authorization_header(admin))

    assert response.status_code == 200
    assert response.json() == []


def test_task_creation_requires_admin_authorization(client):
    response = client.post(
        "/api/tasks/",
        json={"title": "Task", "subject": "algebra"},
    )

    assert response.status_code == 401

