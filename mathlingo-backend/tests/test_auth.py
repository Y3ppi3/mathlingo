from datetime import timedelta

from app.auth import create_access_token, verify_password


def test_register_creates_user_and_sets_secure_cookie(client):
    response = client.post(
        "/api/register/",
        json={
            "username": "student",
            "email": "student@example.com",
            "password": "password123",
        },
    )

    assert response.status_code == 200
    assert response.json() == {"message": "Регистрация успешна"}
    assert "token" not in response.json()
    assert "HttpOnly" in response.headers["set-cookie"]
    assert "Secure" in response.headers["set-cookie"]
    assert "SameSite=strict" in response.headers["set-cookie"]


def test_register_rejects_duplicate_email(client, user):
    response = client.post(
        "/api/register/",
        json={
            "username": "another-student",
            "email": user.email,
            "password": "password123",
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Email уже используется"


def test_login_rejects_invalid_password(client, user):
    response = client.post(
        "/api/login/",
        json={"email": user.email, "password": "wrong-password"},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Неверный email или пароль"


def test_current_user_requires_valid_token(client):
    response = client.get("/api/me")

    assert response.status_code == 401


def test_current_user_returns_authenticated_user(client, user):
    token = create_access_token({"sub": user.email})
    response = client.get("/api/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    assert response.json() == {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "avatarId": None,
    }


def test_expired_token_is_rejected(client, user):
    token = create_access_token({"sub": user.email}, expires_delta=timedelta(seconds=-1))
    response = client.get("/api/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 401


def test_password_hash_cannot_be_verified_with_wrong_password():
    from app.auth import hash_password

    password_hash = hash_password("password123")

    assert verify_password("password123", password_hash)
    assert not verify_password("wrong-password", password_hash)

