from app.auth import create_access_token
from main import csrf_tokens


def test_me_response_issues_csrf_token_for_cookie_session(client, user):
    token = create_access_token({"sub": user.email})
    client.cookies.set("token", token)

    response = client.get("/api/me")

    assert response.status_code == 200
    assert response.headers["x-csrf-token"]
    assert csrf_tokens[token][0] == response.headers["x-csrf-token"]


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

