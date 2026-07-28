"""
Единый каталог игр, рейтинг/лидерборды и учебный уровень (school/student/
advanced): ученик задаёт уровень сам, админ может переопределить.
"""
from app.auth import create_access_token, hash_password
from app.models import User
from tests.conftest import authorization_header


def _student_header(user):
    return {"Authorization": f"Bearer {create_access_token({'sub': user.email})}"}


def _mk_user(db, name):
    u = User(username=name, email=f"{name}@example.com", hashed_password=hash_password("password123"))
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


def _progress(client, user, game_id, level_id, stars, metric):
    client.post("/api/games/progress", headers=_student_header(user),
                json={"game_id": game_id, "level_id": level_id, "stars": stars, "metric": metric})


# --- Каталог ---

def test_catalog_lists_all_games_with_levels(client, user):
    resp = client.get("/api/games/catalog", headers=_student_header(user))
    assert resp.status_code == 200
    entries = resp.json()["entries"]
    ids = {e["id"] for e in entries}
    assert {"gauss_jordan", "eigen_arrow", "deriv-fall", "slope-field"} <= ids
    gj = next(e for e in entries if e["id"] == "gauss_jordan")
    assert gj["launch"]["kind"] == "internal"
    assert "student" in gj["levels"]
    df = next(e for e in entries if e["id"] == "deriv-fall")
    assert df["launch"]["kind"] == "subject"
    assert df["launch"]["subject_hint"] == "derivatives"


def test_catalog_requires_auth(client):
    assert client.get("/api/games/catalog").status_code == 401


def test_catalog_covers_every_learner_level(client, user):
    """Ф4: у каждого учебного уровня есть хотя бы одна игра. До Ф4 school был
    пуст, и школьник видел пустой каталог — регресс сюда же и вернётся."""
    entries = client.get("/api/games/catalog", headers=_student_header(user)).json()["entries"]
    for level in User.LEVELS:
        assert any(level in e["levels"] for e in entries), f"нет ни одной игры для уровня {level}"


def test_catalog_entries_are_well_formed(client, user):
    """Каталог — единственный источник игр, и фронт разбирает launch вслепую:
    неизвестный kind или subject-игра без подсказки предмета = битая кнопка."""
    entries = client.get("/api/games/catalog", headers=_student_header(user)).json()["entries"]
    ids = [e["id"] for e in entries]
    assert len(ids) == len(set(ids)), "в каталоге дублирующиеся id"
    for e in entries:
        assert e["levels"], f"{e['id']}: игра не привязана ни к одному уровню"
        assert set(e["levels"]) <= set(User.LEVELS), f"{e['id']}: неизвестный уровень"
        assert e["launch"]["kind"] in ("internal", "subject"), f"{e['id']}: неизвестный kind"
        if e["launch"]["kind"] == "subject":
            assert e["launch"]["subject_hint"], f"{e['id']}: subject-игра без subject_hint"


# --- Лидерборд ---

def test_leaderboard_ranks_by_stars(client, db):
    alice = _mk_user(db, "alice")
    bob = _mk_user(db, "bob")
    # alice: 3 + 2 = 5 звёзд на 2 уровнях; bob: 3 звезды на 1 уровне.
    _progress(client, alice, "gauss_jordan", "gj-1", 3, 2)
    _progress(client, alice, "gauss_jordan", "gj-2", 2, 5)
    _progress(client, bob, "gauss_jordan", "gj-1", 3, 1)

    body = client.get("/api/games/leaderboard", headers=_student_header(alice)).json()
    assert body["game_id"] is None
    ranks = [(e["username"], e["rank"], e["stars"], e["levels_completed"]) for e in body["entries"]]
    assert ranks[0] == ("alice", 1, 5, 2)
    assert ranks[1] == ("bob", 2, 3, 1)
    # me — позиция текущего игрока (alice).
    assert body["me"]["username"] == "alice" and body["me"]["rank"] == 1


def test_leaderboard_filters_by_game(client, db):
    alice = _mk_user(db, "alice2")
    _progress(client, alice, "gauss_jordan", "gj-1", 3, 2)
    _progress(client, alice, "eigen_arrow", "ea-1", 1, 4)

    all_games = client.get("/api/games/leaderboard", headers=_student_header(alice)).json()
    assert all_games["me"]["stars"] == 4  # 3 + 1 по всем играм

    one_game = client.get("/api/games/leaderboard", params={"game_id": "eigen_arrow"},
                          headers=_student_header(alice)).json()
    assert one_game["game_id"] == "eigen_arrow"
    assert one_game["me"]["stars"] == 1


def test_leaderboard_me_is_none_without_progress(client, user):
    body = client.get("/api/games/leaderboard", headers=_student_header(user)).json()
    assert body["entries"] == []
    assert body["me"] is None


# --- Учебный уровень: студент сам ---

def test_me_reports_level_and_self_set(client, user):
    hdr = _student_header(user)
    assert client.get("/api/me", headers=hdr).json()["level"] is None

    resp = client.put("/api/me/level", headers=hdr, json={"level": "student"})
    assert resp.status_code == 200 and resp.json()["level"] == "student"
    assert client.get("/api/me", headers=hdr).json()["level"] == "student"


def test_self_set_invalid_level_rejected(client, user):
    resp = client.put("/api/me/level", headers=_student_header(user), json={"level": "phd"})
    assert resp.status_code == 400


def test_self_set_can_reset_to_null(client, user):
    hdr = _student_header(user)
    client.put("/api/me/level", headers=hdr, json={"level": "advanced"})
    client.put("/api/me/level", headers=hdr, json={"level": None})
    assert client.get("/api/me", headers=hdr).json()["level"] is None


def test_level_requires_auth(client):
    assert client.put("/api/me/level", json={"level": "student"}).status_code == 401


# --- Учебный уровень: админ переопределяет ---

def test_admin_can_override_level(client, user, admin):
    resp = client.put(f"/admin/users/{user.id}/level",
                      headers=authorization_header(admin), json={"level": "school"})
    assert resp.status_code == 200 and resp.json()["level"] == "school"
    # Виден в списке пользователей админки.
    users = client.get("/admin/users", headers=authorization_header(admin)).json()
    assert any(u["id"] == user.id and u["level"] == "school" for u in users)


def test_admin_override_invalid_level_400(client, user, admin):
    resp = client.put(f"/admin/users/{user.id}/level",
                      headers=authorization_header(admin), json={"level": "wizard"})
    assert resp.status_code == 400


def test_admin_override_unknown_user_404(client, admin):
    resp = client.put("/admin/users/999999/level",
                      headers=authorization_header(admin), json={"level": "student"})
    assert resp.status_code == 404


def test_admin_override_requires_admin(client, user):
    resp = client.put(f"/admin/users/{user.id}/level",
                      headers=_student_header(user), json={"level": "student"})
    assert resp.status_code in (401, 403)
