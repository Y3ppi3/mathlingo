# tests/test_password_reset.py
"""
R4: forgot-password. Email-провайдер — MockEmailProvider (см.
app/services/email.py), поэтому здесь проверяется весь флоу end-to-end
через Redis-токен, а не факт отправки письма: request -> достаём токен
напрямую из Redis (как это делал бы реальный email) -> confirm -> логин
новым паролем.
"""
from app.auth import verify_password
from app.models import User
from app.services import cache, password_reset


def _get_reset_token_from_redis() -> str:
    """
    В тестах нет реального email — токен вычленяем из Redis по префиксу,
    как это делает сам password_reset.request_reset при генерации ссылки.
    """
    client = cache.get_client()
    keys = list(client.scan_iter(f"{password_reset.RESET_TOKEN_PREFIX}*"))
    assert len(keys) == 1, "ожидался ровно один активный reset-токен"
    return keys[0][len(password_reset.RESET_TOKEN_PREFIX):]


def test_request_reset_returns_204_for_existing_email(client, user):
    response = client.post("/api/password-reset/request", json={"email": user.email})
    assert response.status_code == 204


def test_request_reset_returns_204_for_unknown_email_without_leaking(client):
    """Тот же ответ для несуществующего email — иначе эндпоинт раскрывал бы, какие адреса зарегистрированы."""
    response = client.post("/api/password-reset/request", json={"email": "nobody@example.com"})
    assert response.status_code == 204
    assert cache.get_client().keys(f"{password_reset.RESET_TOKEN_PREFIX}*") == []


def test_full_reset_flow_changes_password(client, user, db):
    old_hash = user.hashed_password

    request = client.post("/api/password-reset/request", json={"email": user.email})
    assert request.status_code == 204

    token = _get_reset_token_from_redis()

    confirm = client.post(
        "/api/password-reset/confirm",
        json={"token": token, "new_password": "brand-new-password123"},
    )
    assert confirm.status_code == 200

    db.refresh(user)
    assert user.hashed_password != old_hash
    assert verify_password("brand-new-password123", user.hashed_password)

    login = client.post(
        "/api/login/",
        json={"email": user.email, "password": "brand-new-password123"},
    )
    assert login.status_code == 200


def test_reset_token_is_single_use(client, user):
    client.post("/api/password-reset/request", json={"email": user.email})
    token = _get_reset_token_from_redis()

    first = client.post("/api/password-reset/confirm", json={"token": token, "new_password": "first-new-pass123"})
    assert first.status_code == 200

    second = client.post("/api/password-reset/confirm", json={"token": token, "new_password": "second-new-pass123"})
    assert second.status_code == 400


def test_confirm_with_invalid_token_is_rejected(client):
    response = client.post(
        "/api/password-reset/confirm",
        json={"token": "not-a-real-token", "new_password": "whatever-password123"},
    )
    assert response.status_code == 400


def test_confirm_rejects_too_short_password(client, user):
    client.post("/api/password-reset/request", json={"email": user.email})
    token = _get_reset_token_from_redis()

    response = client.post("/api/password-reset/confirm", json={"token": token, "new_password": "short"})
    assert response.status_code == 400


def test_request_reset_is_rate_limited(client, db):
    """4-й запрос за час на один email не должен выпускать новый токен."""
    target = User(username="ratelimited", email="ratelimited@example.com", hashed_password="x")
    db.add(target)
    db.commit()
    db.refresh(target)

    for _ in range(password_reset.RATE_LIMIT_MAX_REQUESTS):
        response = client.post("/api/password-reset/request", json={"email": target.email})
        assert response.status_code == 204

    tokens_before = set(cache.get_client().keys(f"{password_reset.RESET_TOKEN_PREFIX}*"))
    assert len(tokens_before) == password_reset.RATE_LIMIT_MAX_REQUESTS

    over_limit = client.post("/api/password-reset/request", json={"email": target.email})
    assert over_limit.status_code == 204  # тот же no-leak ответ, но токен не перевыпускается

    tokens_after = set(cache.get_client().keys(f"{password_reset.RESET_TOKEN_PREFIX}*"))
    assert tokens_after == tokens_before
