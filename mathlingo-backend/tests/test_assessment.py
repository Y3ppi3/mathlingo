"""
Фаза 6: диагностический квиз до/после игр. Скоринг на сервере, правильные
ответы наружу не отдаются, primary_game считается по телеметрии, admin видит
Δ обучения по парам pre/post.
"""
from app.auth import create_access_token
from app.models import AssessmentResult
from app.services import assessment
from tests.conftest import authorization_header


def _student_header(user):
    return {"Authorization": f"Bearer {create_access_token({'sub': user.email})}"}


def _all_correct_answers():
    return {q["id"]: q["correct"] for q in assessment.QUESTIONS}


def _post_complete(client, user, game_id, level_id):
    """Проходит уровень (level_complete) — чтобы primary_game считался по игре."""
    client.post("/api/games/events", headers=_student_header(user), json={
        "game_id": game_id,
        "events": [
            {"event_type": "level_start", "payload": {"level_id": level_id}},
            {"event_type": "level_complete", "payload": {"level_id": level_id, "stars": 3}},
        ],
        "end_session": True,
    })


# --- Выдача вопросов ---

def test_get_quiz_hides_correct_answers(client, user):
    resp = client.get("/api/games/assessment/pre", headers=_student_header(user))
    assert resp.status_code == 200
    body = resp.json()
    assert body["quiz_type"] == "pre"
    assert body["max_score"] == assessment.MAX_SCORE
    assert body["already_taken"] is False
    assert len(body["questions"]) == assessment.MAX_SCORE
    for q in body["questions"]:
        assert set(q.keys()) == {"id", "concept", "prompt", "options"}
        assert "correct" not in q


def test_get_quiz_unknown_type_404(client, user):
    resp = client.get("/api/games/assessment/midterm", headers=_student_header(user))
    assert resp.status_code == 404


def test_quiz_requires_auth(client):
    assert client.get("/api/games/assessment/pre").status_code == 401


# --- Скоринг ---

def test_submit_scores_and_persists(client, user, db):
    resp = client.post("/api/games/assessment/pre", headers=_student_header(user),
                       json={"answers": _all_correct_answers()})
    assert resp.status_code == 200
    body = resp.json()
    assert body["score"] == assessment.MAX_SCORE
    assert body["max_score"] == assessment.MAX_SCORE
    assert body["quiz_type"] == "pre"
    # Не играл — primary_game None.
    assert body["primary_game"] is None

    row = db.query(AssessmentResult).filter(AssessmentResult.user_id == user.id).first()
    assert row is not None and row.score == assessment.MAX_SCORE


def test_submit_partial_and_unknown_ids_ignored(client, user):
    q0 = assessment.QUESTIONS[0]
    wrong = (q0["correct"] + 1) % len(q0["options"])
    answers = {
        q0["id"]: q0["correct"],                        # верно
        assessment.QUESTIONS[1]["id"]: wrong,           # неверно
        "no-such-question": 0,                          # лишний ключ — игнор
    }
    resp = client.post("/api/games/assessment/post", headers=_student_header(user),
                       json={"answers": answers})
    assert resp.json()["score"] == 1


def test_submit_unknown_type_404(client, user):
    resp = client.post("/api/games/assessment/final", headers=_student_header(user),
                       json={"answers": {}})
    assert resp.status_code == 404


# --- primary_game по телеметрии ---

def test_primary_game_follows_most_played(client, user):
    _post_complete(client, user, "eigen_arrow", "ea-1")
    _post_complete(client, user, "eigen_arrow", "ea-2")
    _post_complete(client, user, "gauss_jordan", "gj-1")

    body = client.post("/api/games/assessment/post", headers=_student_header(user),
                       json={"answers": {}}).json()
    assert body["primary_game"] == "eigen_arrow"


# --- Статус ---

def test_status_reflects_taken(client, user):
    hdr = _student_header(user)
    before = client.get("/api/games/assessment/status", headers=hdr).json()
    assert before == {"pre_taken": False, "post_taken": False, "max_score": assessment.MAX_SCORE}

    client.post("/api/games/assessment/pre", headers=hdr, json={"answers": {}})
    after = client.get("/api/games/assessment/status", headers=hdr).json()
    assert after["pre_taken"] is True and after["post_taken"] is False


# --- Admin: Δ обучения ---

def test_learning_delta_pairs_pre_and_post(client, user, admin):
    hdr = _student_header(user)
    q = assessment.QUESTIONS

    # pre: 2 правильных из 6.
    pre_answers = {q[0]["id"]: q[0]["correct"], q[1]["id"]: q[1]["correct"]}
    client.post("/api/games/assessment/pre", headers=hdr, json={"answers": pre_answers})

    # Поиграл в gauss_jordan, затем post: все правильные.
    _post_complete(client, user, "gauss_jordan", "gj-1")
    client.post("/api/games/assessment/post", headers=hdr, json={"answers": _all_correct_answers()})

    resp = client.get("/admin/games/learning", headers=authorization_header(admin))
    assert resp.status_code == 200
    data = resp.json()
    assert data["max_score"] == assessment.MAX_SCORE
    assert data["paired_users"] == 1
    assert data["avg_pre"] == 2.0
    assert data["avg_post"] == float(assessment.MAX_SCORE)
    assert data["avg_delta"] == float(assessment.MAX_SCORE - 2)

    by_game = {g["primary_game"]: g for g in data["by_game"]}
    assert "gauss_jordan" in by_game
    assert by_game["gauss_jordan"]["avg_delta"] == float(assessment.MAX_SCORE - 2)


def test_learning_delta_uses_latest_attempt_per_type(client, user, admin):
    hdr = _student_header(user)
    # Две pre-попытки: последняя (все верно) должна победить.
    client.post("/api/games/assessment/pre", headers=hdr, json={"answers": {}})  # 0
    client.post("/api/games/assessment/pre", headers=hdr, json={"answers": _all_correct_answers()})  # max
    client.post("/api/games/assessment/post", headers=hdr, json={"answers": _all_correct_answers()})

    data = client.get("/admin/games/learning", headers=authorization_header(admin)).json()
    assert data["paired_users"] == 1
    assert data["avg_pre"] == float(assessment.MAX_SCORE)
    assert data["avg_delta"] == 0.0


def test_learning_requires_admin(client, user):
    # Студенческий токен не должен открывать admin-аналитику обучения.
    resp = client.get("/admin/games/learning", headers=_student_header(user))
    assert resp.status_code in (401, 403)
