"""
Ф3: тренажёр курса ЕГЭ/ОГЭ — проверка ответа, попытки в общем Attempt,
подбор следующего задания и прогресс по номерам.
"""
from app.auth import create_access_token
from app.models import Attempt, ExamTask


def _hdr(user):
    return {"Authorization": f"Bearer {create_access_token({'sub': user.email})}"}


def _seed(db, **kw):
    defaults = dict(exam="oge", track=None, task_number=1, topic="Арифметика",
                    difficulty=1, statement="2+2?", answer_type="single_answer",
                    answer="4", solution="дважды два", source="manual")
    defaults.update(kw)
    t = ExamTask(**defaults)
    db.add(t)
    db.commit()
    db.refresh(t)
    return t


# --- Нормализация ответа ---

def test_answer_normalization_accepts_human_formatting(client, user, db):
    from app.services import exam_trainer
    task = _seed(db, answer="0.25")
    # Запятая как разделитель и лишние пробелы — это форма записи, а не ошибка.
    assert exam_trainer.check_answer(task, " 0,25 ") is True
    assert exam_trainer.check_answer(task, "0.25") is True
    # А вот другое число — ошибка, нормализация не должна это «прощать».
    assert exam_trainer.check_answer(task, "0.5") is False
    assert exam_trainer.check_answer(task, "") is False
    assert exam_trainer.check_answer(task, None) is False


def test_normalization_is_case_insensitive(client, db):
    from app.services import exam_trainer
    assert exam_trainer.check_answer(_seed(db, answer="Да"), "да") is True


# --- Попытки ---

def test_attempt_correct_returns_solution_and_writes_attempt(client, user, db):
    task = _seed(db, answer="33", solution="7·3=21, 12+21=33")
    resp = client.post("/api/exam/attempt", headers=_hdr(user),
                       json={"task_id": task.id, "answer": "33", "time_spent_ms": 4200})
    assert resp.status_code == 200
    body = resp.json()
    assert body["correct"] is True
    assert body["correct_answer"] == "33"
    assert body["solution"] == "7·3=21, 12+21=33"

    att = db.query(Attempt).filter(Attempt.content_type == "exam").one()
    assert att.user_id == user.id and att.content_id == task.id
    assert att.is_correct is True and att.time_spent_ms == 4200


def test_attempt_wrong_still_returns_solution(client, user, db):
    """Ошибка — точка обучения: разбор показываем, а не прячем."""
    task = _seed(db, answer="33", solution="7·3=21, 12+21=33")
    body = client.post("/api/exam/attempt", headers=_hdr(user),
                       json={"task_id": task.id, "answer": "57"}).json()
    assert body["correct"] is False
    assert body["solution"] == "7·3=21, 12+21=33"
    assert db.query(Attempt).one().is_correct is False


def test_attempt_404_and_requires_auth(client, user):
    assert client.post("/api/exam/attempt", headers=_hdr(user),
                       json={"task_id": 999999, "answer": "1"}).status_code == 404
    assert client.post("/api/exam/attempt", json={"task_id": 1, "answer": "1"}).status_code == 401


def test_answer_never_leaks_before_attempt(client, user, db):
    """Ключевое свойство банка: условие можно листать, ответ — только после попытки."""
    task = _seed(db, answer="33")
    one = client.get(f"/api/exam/tasks/{task.id}", headers=_hdr(user)).json()
    assert "answer" not in one and "solution" not in one


# --- Подбор следующего задания ---

def test_next_prefers_unseen_then_unsolved(client, user, db):
    a = _seed(db, statement="A", answer="1")
    b = _seed(db, statement="B", answer="2")

    first = client.get("/api/exam/next", headers=_hdr(user)).json()
    assert first["id"] == a.id

    # Ответили на A неверно — A всё ещё нерешён, но B ещё не виден: новое важнее.
    client.post("/api/exam/attempt", headers=_hdr(user), json={"task_id": a.id, "answer": "нет"})
    assert client.get("/api/exam/next", headers=_hdr(user)).json()["id"] == b.id

    # B решён верно, A виден и нерешён → возвращаемся к работе над ошибками.
    client.post("/api/exam/attempt", headers=_hdr(user), json={"task_id": b.id, "answer": "2"})
    assert client.get("/api/exam/next", headers=_hdr(user)).json()["id"] == a.id

    # Всё решено — тренажёр не упирается в тупик, а даёт повтор.
    client.post("/api/exam/attempt", headers=_hdr(user), json={"task_id": a.id, "answer": "1"})
    assert client.get("/api/exam/next", headers=_hdr(user)).json()["id"] in (a.id, b.id)


def test_next_respects_filters_and_404s_when_empty(client, user, db):
    _seed(db, exam="oge", task_number=1)
    _seed(db, exam="ege", track="profile", task_number=7, topic="Производная")

    got = client.get("/api/exam/next", headers=_hdr(user),
                     params={"exam": "ege", "track": "profile"}).json()
    assert got["topic"] == "Производная"
    assert client.get("/api/exam/next", headers=_hdr(user),
                      params={"exam": "ege", "track": "base"}).status_code == 404


def test_next_isolated_per_user(client, user, db):
    """Прогресс одного ученика не должен влиять на подбор для другого."""
    from app.models import User as UserModel
    from app.auth import hash_password
    a = _seed(db, statement="A", answer="1")
    _seed(db, statement="B", answer="2")
    client.post("/api/exam/attempt", headers=_hdr(user), json={"task_id": a.id, "answer": "1"})

    other = UserModel(username="other", email="other@example.com",
                      hashed_password=hash_password("x"))
    db.add(other)
    db.commit()
    assert client.get("/api/exam/next", headers=_hdr(other)).json()["id"] == a.id


# --- Прогресс ---

def test_progress_counts_solved_accuracy_and_mastery(client, user, db):
    t1 = _seed(db, task_number=1, topic="Арифметика", answer="1")
    t2 = _seed(db, task_number=1, topic="Арифметика", answer="2")
    _seed(db, task_number=9, topic="Проценты", answer="180")

    client.post("/api/exam/attempt", headers=_hdr(user), json={"task_id": t1.id, "answer": "1"})
    client.post("/api/exam/attempt", headers=_hdr(user), json={"task_id": t2.id, "answer": "нет"})
    client.post("/api/exam/attempt", headers=_hdr(user), json={"task_id": t2.id, "answer": "2"})

    body = client.get("/api/exam/progress", headers=_hdr(user), params={"exam": "oge"}).json()
    assert body["total_tasks"] == 3
    assert body["solved_tasks"] == 2       # разных решённых
    assert body["attempts"] == 3 and body["correct"] == 2
    assert body["accuracy"] == 0.667

    arith = next(i for i in body["items"] if i["task_number"] == 1)
    assert arith["total"] == 2 and arith["solved"] == 2
    # Номер закрыт: решены все 2 задания, хотя порог MASTERY_SOLVED = 3.
    assert arith["mastered"] is True

    percent = next(i for i in body["items"] if i["task_number"] == 9)
    assert percent["solved"] == 0 and percent["accuracy"] is None
    assert percent["mastered"] is False
    assert body["mastered_numbers"] == 1


def test_progress_empty_for_fresh_user(client, user, db):
    _seed(db)
    body = client.get("/api/exam/progress", headers=_hdr(user)).json()
    assert body["total_tasks"] == 1 and body["solved_tasks"] == 0
    assert body["attempts"] == 0 and body["accuracy"] is None


def test_progress_ignores_non_exam_attempts(client, user, db):
    """content_type — generic; попытки из адвенчера не должны попасть в курс."""
    task = _seed(db)
    db.add(Attempt(user_id=user.id, content_type="task", content_id=task.id, is_correct=True))
    db.commit()
    body = client.get("/api/exam/progress", headers=_hdr(user)).json()
    assert body["attempts"] == 0 and body["solved_tasks"] == 0
