import re
import time
from datetime import timedelta

import jwt

from app.auth import ALGORITHM, SECRET_KEY, create_access_token, verify_password


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


def _cookie_max_age(set_cookie_header: str) -> int:
    match = re.search(r"Max-Age=(\d+)", set_cookie_header)
    assert match, f"Max-Age не найден в Set-Cookie: {set_cookie_header}"
    return int(match.group(1))


def _cookie_token(set_cookie_header: str) -> str:
    match = re.search(r"token=([^;]+)", set_cookie_header)
    assert match, f"token не найден в Set-Cookie: {set_cookie_header}"
    return match.group(1)


# "Запомнить меня" (R4) — без remember_me сессия как раньше (1 день);
# с remember_me — и cookie, и сам JWT должны жить дольше (см. правку:
# без продления самого токена запросы всё равно начали бы падать раньше
# истечения cookie).
def test_login_without_remember_me_uses_default_session_length(client, user):
    response = client.post("/api/login/", json={"email": user.email, "password": "password123"})

    assert response.status_code == 200
    assert _cookie_max_age(response.headers["set-cookie"]) == 86400

    # Без remember_me expires_delta не передаётся — действует
    # ACCESS_TOKEN_EXPIRE_MINUTES по умолчанию (7 дней), не 30.
    token = _cookie_token(response.headers["set-cookie"])
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    remaining_days = (payload["exp"] - time.time()) / 86400
    assert 6 < remaining_days < 8


def test_login_with_remember_me_extends_session_to_30_days(client, user):
    response = client.post(
        "/api/login/",
        json={"email": user.email, "password": "password123", "remember_me": True},
    )

    assert response.status_code == 200
    assert _cookie_max_age(response.headers["set-cookie"]) == 60 * 60 * 24 * 30

    token = _cookie_token(response.headers["set-cookie"])
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    remaining_days = (payload["exp"] - time.time()) / 86400
    assert 29 < remaining_days < 31

