"""
Эндпоинты матричных мини-игр (Фаза 0): приём телеметрии батчами, апсерт
прогресса «лучший результат», мок-конфиг уровней. Аутентификация — Bearer
(как и остальные студенческие эндпоинты); CSRF в тестах не участвует, т.к.
нет cookie `token` (см. csrf_protection в main.py).
"""
from app.auth import create_access_token
from app.models import GameEvent, GameSession, User, UserGameProgress


def _student_header(user):
    token = create_access_token({"sub": user.email})
    return {"Authorization": f"Bearer {token}"}


def _other_user(db):
    from app.auth import hash_password
    item = User(username="other", email="other@example.com",
                hashed_password=hash_password("password123"))
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


# --- Телеметрия ---

def test_post_events_creates_session(client, user, db):
    resp = client.post("/api/games/events", headers=_student_header(user), json={
        "game_id": "gauss_jordan",
        "events": [
            {"event_type": "level_start", "payload": {"level_id": "gj-1"}},
            {"event_type": "move_made", "payload": {"op": "combine"}},
        ],
    })
    assert resp.status_code == 200
    body = resp.json()
    assert body["accepted"] == 2
    session_id = body["session_id"]

    session = db.query(GameSession).filter(GameSession.id == session_id).first()
    assert session is not None
    assert session.user_id == user.id
    assert session.game_id == "gauss_jordan"
    assert session.ended_at is None
    assert db.query(GameEvent).filter(GameEvent.session_id == session_id).count() == 2


def test_post_events_continues_existing_session(client, user, db):
    first = client.post("/api/games/events", headers=_student_header(user), json={
        "game_id": "gauss_jordan",
        "events": [{"event_type": "level_start", "payload": {}}],
    }).json()
    session_id = first["session_id"]

    client.post("/api/games/events", headers=_student_header(user), json={
        "game_id": "gauss_jordan",
        "session_id": session_id,
        "events": [{"event_type": "move_made", "payload": {}}],
    })

    assert db.query(GameSession).filter(GameSession.user_id == user.id).count() == 1
    assert db.query(GameEvent).filter(GameEvent.session_id == session_id).count() == 2


def test_post_events_end_session_sets_ended_at(client, user, db):
    resp = client.post("/api/games/events", headers=_student_header(user), json={
        "game_id": "eigen_arrow",
        "events": [{"event_type": "level_complete", "payload": {}}],
        "end_session": True,
    })
    session_id = resp.json()["session_id"]
    session = db.query(GameSession).filter(GameSession.id == session_id).first()
    assert session.ended_at is not None


def test_post_events_game_mismatch_rejected(client, user, db):
    session_id = client.post("/api/games/events", headers=_student_header(user), json={
        "game_id": "gauss_jordan",
        "events": [{"event_type": "level_start", "payload": {}}],
    }).json()["session_id"]

    resp = client.post("/api/games/events", headers=_student_header(user), json={
        "game_id": "eigen_arrow",
        "session_id": session_id,
        "events": [{"event_type": "move_made", "payload": {}}],
    })
    assert resp.status_code == 400


def test_post_events_foreign_session_404(client, user, db):
    other = _other_user(db)
    foreign_session_id = client.post("/api/games/events", headers=_student_header(other), json={
        "game_id": "gauss_jordan",
        "events": [{"event_type": "level_start", "payload": {}}],
    }).json()["session_id"]

    resp = client.post("/api/games/events", headers=_student_header(user), json={
        "game_id": "gauss_jordan",
        "session_id": foreign_session_id,
        "events": [{"event_type": "move_made", "payload": {}}],
    })
    assert resp.status_code == 404


def test_events_requires_authentication(client):
    resp = client.post("/api/games/events", json={
        "game_id": "gauss_jordan",
        "events": [{"event_type": "level_start", "payload": {}}],
    })
    assert resp.status_code == 401


def test_events_unknown_game_rejected_422(client, user):
    resp = client.post("/api/games/events", headers=_student_header(user), json={
        "game_id": "tic_tac_toe",
        "events": [{"event_type": "level_start", "payload": {}}],
    })
    assert resp.status_code == 422


# --- Прогресс ---

def test_progress_upsert_keeps_best_result(client, user, db):
    hdr = _student_header(user)
    payload = {"game_id": "gauss_jordan", "level_id": "gj-1"}

    # Первый заход: 2 звезды, 10 ходов.
    client.post("/api/games/progress", headers=hdr, json={**payload, "stars": 2, "metric": 10})
    # Хуже по звёздам — не затирает.
    client.post("/api/games/progress", headers=hdr, json={**payload, "stars": 1, "metric": 3})
    row = db.query(UserGameProgress).filter(
        UserGameProgress.user_id == user.id, UserGameProgress.level_id == "gj-1").first()
    assert row.best_stars == 2 and row.best_metric == 10

    # Лучше по звёздам — обновляет.
    client.post("/api/games/progress", headers=hdr, json={**payload, "stars": 3, "metric": 20})
    db.refresh(row)
    assert row.best_stars == 3 and row.best_metric == 20

    # Те же звёзды, меньше ходов — обновляет метрику.
    resp = client.post("/api/games/progress", headers=hdr, json={**payload, "stars": 3, "metric": 12})
    assert resp.status_code == 200
    db.refresh(row)
    assert row.best_stars == 3 and row.best_metric == 12

    # Те же звёзды, больше ходов — не затирает.
    client.post("/api/games/progress", headers=hdr, json={**payload, "stars": 3, "metric": 99})
    db.refresh(row)
    assert row.best_metric == 12


def test_get_progress_filters_by_game(client, user):
    hdr = _student_header(user)
    client.post("/api/games/progress", headers=hdr,
                json={"game_id": "gauss_jordan", "level_id": "gj-1", "stars": 1, "metric": 5})
    client.post("/api/games/progress", headers=hdr,
                json={"game_id": "eigen_arrow", "level_id": "ea-1", "stars": 2, "metric": 6})

    all_rows = client.get("/api/games/progress", headers=hdr).json()
    assert len(all_rows) == 2

    filtered = client.get("/api/games/progress", headers=hdr, params={"game_id": "eigen_arrow"}).json()
    assert len(filtered) == 1
    assert filtered[0]["game_id"] == "eigen_arrow"


def test_progress_requires_authentication(client):
    resp = client.get("/api/games/progress")
    assert resp.status_code == 401


# --- Конфиг уровней ---

def test_levels_returns_mock_config(client, user):
    resp = client.get("/api/games/levels/gauss_jordan", headers=_student_header(user))
    assert resp.status_code == 200
    body = resp.json()
    assert body["game_id"] == "gauss_jordan"
    assert len(body["levels"]) == 5
    assert body["levels"][0]["level_id"] == "gj-1"


def test_levels_unknown_game_404(client, user):
    resp = client.get("/api/games/levels/tic_tac_toe", headers=_student_header(user))
    assert resp.status_code == 404
