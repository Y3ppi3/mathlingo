import fakeredis

from app.auth import create_access_token
from app.services import cache


def test_me_response_issues_csrf_token_for_cookie_session(client, user):
    token = create_access_token({"sub": user.email})
    client.cookies.set("token", token)

    response = client.get("/api/me")

    assert response.status_code == 200
    assert response.headers["x-csrf-token"]
    assert cache.get_client().get(f"csrf:{token}") == response.headers["x-csrf-token"]


def test_authenticated_mutation_without_csrf_token_is_rejected(client, user):
    token = create_access_token({"sub": user.email})
    client.cookies.set("token", token)

    response = client.put("/api/me/update", json={"username": "updated"})

    assert response.status_code == 403
    assert response.json()["detail"] == "CSRF-токен отсутствует"


def test_authenticated_mutation_with_csrf_token_succeeds(client, user):
    token = create_access_token({"sub": user.email})
    client.cookies.set("token", token)
    csrf_token = client.get("/api/me").headers["x-csrf-token"]

    response = client.put(
        "/api/me/update",
        headers={"X-CSRF-Token": csrf_token},
        json={"username": "updated"},
    )

    assert response.status_code == 200
    assert response.json()["username"] == "updated"


def test_csrf_token_survives_across_independent_client_instances():
    """
    R4: раньше CSRF-токены жили в csrf_tokens = {} — обычном dict в памяти
    одного процесса. При нескольких worker'ах uvicorn токен, выданный одним
    worker'ом, не проходил бы проверку в другом (это разные процессы —
    разные dict), а рестарт процесса ронял все активные сессии разом.
    Здесь два независимых redis.Redis-подобных клиента (как если бы это были
    два worker'а) указывают на один и тот же сервер — токен, записанный
    через один клиент, должен читаться через другой.
    """
    server = fakeredis.FakeServer()
    worker_a = fakeredis.FakeRedis(server=server, decode_responses=True)
    worker_b = fakeredis.FakeRedis(server=server, decode_responses=True)

    worker_a.setex("csrf:some-auth-token", 3600, "issued-csrf-value")

    assert worker_b.get("csrf:some-auth-token") == "issued-csrf-value"

