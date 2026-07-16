"""
Фаза 5: аналитика вовлечённости матричных мини-игр (/admin/games/analytics).
Телеметрию генерируем через реальный студенческий эндпоинт (как в проде),
агрегаты читаем admin-ролью. Бэкдейт окна и мастерство — напрямую через БД,
чтобы контролировать started_at/лучший результат.
"""
from datetime import datetime, timedelta

from app.auth import create_access_token
from app.models import GameEvent, GameSession, UserGameProgress
from tests.conftest import authorization_header


def _student_header(user):
    return {"Authorization": f"Bearer {create_access_token({'sub': user.email})}"}


def _post_events(client, user, game_id, events, end_session=True, session_id=None):
    body = {"game_id": game_id, "events": events, "end_session": end_session}
    if session_id is not None:
        body["session_id"] = session_id
    return client.post("/api/games/events", headers=_student_header(user), json=body).json()


def _stats(payload, game_id):
    return next(g for g in payload["games"] if g["game_id"] == game_id)


# --- Воронка и сессии ---

def test_analytics_funnel_and_sessions(client, user, admin):
    # S1: заход с прохождением gj-1 на 3★ за 2 хода.
    _post_events(client, user, "gauss_jordan", [
        {"event_type": "level_start", "payload": {"level_id": "gj-1"}},
        {"event_type": "move_made", "payload": {"level_id": "gj-1", "op": "scale"}},
        {"event_type": "move_made", "payload": {"level_id": "gj-1", "op": "combine"}},
        {"event_type": "level_complete", "payload": {"level_id": "gj-1", "moves": 2, "stars": 3}},
    ])
    # S2: заход с брошенным gj-2.
    _post_events(client, user, "gauss_jordan", [
        {"event_type": "level_start", "payload": {"level_id": "gj-2"}},
        {"event_type": "level_abandon", "payload": {"level_id": "gj-2"}},
    ])

    resp = client.get("/admin/games/analytics", headers=authorization_header(admin))
    assert resp.status_code == 200
    gj = _stats(resp.json(), "gauss_jordan")

    assert gj["players"] == 1
    assert gj["sessions_total"] == 2
    assert gj["sessions_completed"] == 1
    assert gj["sessions_abandoned"] == 1
    assert gj["sessions_open"] == 0
    assert gj["level_starts"] == 2
    assert gj["level_completes"] == 1
    assert gj["completion_rate"] == 0.5
    assert gj["avg_stars"] == 3.0
    assert gj["three_star_share"] == 1.0
    assert gj["avg_session_seconds"] is not None

    by_level = {lv["level_id"]: lv for lv in gj["per_level"]}
    assert by_level["gj-1"]["completes"] == 1
    assert by_level["gj-1"]["completion_rate"] == 1.0
    assert by_level["gj-1"]["avg_stars"] == 3.0
    assert by_level["gj-1"]["avg_metric"] == 2.0
    assert by_level["gj-2"]["starts"] == 1
    assert by_level["gj-2"]["completes"] == 0
    assert by_level["gj-2"]["abandons"] == 1
    assert by_level["gj-2"]["completion_rate"] == 0.0
    assert by_level["gj-2"]["avg_stars"] is None


def test_analytics_open_session_counts_as_open_not_abandoned(client, user, admin):
    # Ушёл, не закрыв сессию (ended_at IS NULL) и без level_abandon.
    _post_events(client, user, "eigen_arrow", [
        {"event_type": "level_start", "payload": {"level_id": "ea-1"}},
        {"event_type": "move_made", "payload": {"level_id": "ea-1", "op": "tick"}},
    ], end_session=False)

    ea = _stats(client.get("/admin/games/analytics", headers=authorization_header(admin)).json(), "eigen_arrow")
    assert ea["sessions_total"] == 1
    assert ea["sessions_open"] == 1
    assert ea["sessions_completed"] == 0
    assert ea["sessions_abandoned"] == 0


def test_analytics_empty_returns_zeroed_games(client, admin):
    payload = client.get("/admin/games/analytics", headers=authorization_header(admin)).json()
    assert {g["game_id"] for g in payload["games"]} == {"gauss_jordan", "eigen_arrow"}
    gj = _stats(payload, "gauss_jordan")
    assert gj["sessions_total"] == 0
    assert gj["completion_rate"] is None
    assert gj["avg_stars"] is None
    assert gj["per_level"] == []


# --- Мастерство из прогресса ---

def test_analytics_mastery_from_progress(client, user, admin):
    hdr = _student_header(user)
    client.post("/api/games/progress", headers=hdr,
                json={"game_id": "eigen_arrow", "level_id": "ea-1", "stars": 3, "metric": 4})
    client.post("/api/games/progress", headers=hdr,
                json={"game_id": "eigen_arrow", "level_id": "ea-2", "stars": 2, "metric": 5})

    ea = _stats(client.get("/admin/games/analytics", headers=authorization_header(admin)).json(), "eigen_arrow")
    assert ea["levels_mastered"] == 1        # только ea-1 на 3★
    assert ea["players_with_mastery"] == 1


# --- Фильтры ---

def test_analytics_days_window_excludes_old_sessions(client, user, admin, db):
    # Свежая сессия через API.
    _post_events(client, user, "gauss_jordan", [
        {"event_type": "level_start", "payload": {"level_id": "gj-1"}},
        {"event_type": "level_complete", "payload": {"level_id": "gj-1", "moves": 3, "stars": 2}},
    ])
    # Старая сессия (10 дней назад) — прямо в БД, чтобы задать started_at.
    old = GameSession(user_id=user.id, game_id="gauss_jordan",
                      started_at=datetime.utcnow() - timedelta(days=10),
                      ended_at=datetime.utcnow() - timedelta(days=10))
    db.add(old)
    db.commit()
    db.refresh(old)
    db.add(GameEvent(session_id=old.id, event_type="level_start", payload={"level_id": "gj-5"}))
    db.add(GameEvent(session_id=old.id, event_type="level_complete",
                     payload={"level_id": "gj-5", "moves": 9, "stars": 1}))
    db.commit()

    all_time = _stats(client.get("/admin/games/analytics",
                                 headers=authorization_header(admin)).json(), "gauss_jordan")
    assert all_time["sessions_total"] == 2
    assert all_time["level_completes"] == 2

    last_day = _stats(client.get("/admin/games/analytics", params={"days": 1},
                                 headers=authorization_header(admin)).json(), "gauss_jordan")
    assert last_day["sessions_total"] == 1
    assert last_day["level_completes"] == 1


def test_analytics_game_id_filter(client, user, admin):
    _post_events(client, user, "gauss_jordan", [
        {"event_type": "level_start", "payload": {"level_id": "gj-1"}},
    ])
    payload = client.get("/admin/games/analytics", params={"game_id": "eigen_arrow"},
                         headers=authorization_header(admin)).json()
    assert len(payload["games"]) == 1
    assert payload["games"][0]["game_id"] == "eigen_arrow"


def test_analytics_unknown_game_404(client, admin):
    resp = client.get("/admin/games/analytics", params={"game_id": "tic_tac_toe"},
                      headers=authorization_header(admin))
    assert resp.status_code == 404


# --- Авторизация ---

def test_analytics_requires_admin(client, user):
    # Студенческий токен — не админ.
    resp = client.get("/admin/games/analytics", headers=_student_header(user))
    assert resp.status_code in (401, 403)


def test_analytics_requires_auth(client):
    assert client.get("/admin/games/analytics").status_code == 401
