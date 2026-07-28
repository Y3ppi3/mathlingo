# tests/test_tutors.py
# Платформа репетиторов, Фаза 1: маркетплейс + связь «репетитор↔ученик».
import pytest

from app.auth import create_access_token, hash_password
from app.models import User


def _make_user(db, username: str, email: str) -> User:
    u = User(username=username, email=email, hashed_password=hash_password("password123"))
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


def _auth(client, user: User):
    # Ставим auth-куку и подтягиваем CSRF-токен (выдаётся на GET /api/me),
    # иначе мутирующие запросы отвергаются CSRF-middleware с 403.
    client.cookies.set("token", create_access_token({"sub": user.email}))
    csrf = client.get("/api/me").headers.get("x-csrf-token", "")
    client.headers["X-CSRF-Token"] = csrf


@pytest.fixture
def tutor_user(db):
    return _make_user(db, "tutor-anna", "tutor@example.com")


@pytest.fixture
def student_user(db):
    return _make_user(db, "student-bob", "student-bob@example.com")


def test_become_tutor_and_appears_in_marketplace(client, db, tutor_user, student_user):
    # изначально пользователь — не репетитор
    _auth(client, tutor_user)
    assert client.get("/api/tutors/me/profile").json() is None

    # становится репетитором
    r = client.put("/api/tutors/me/profile", json={
        "headline": "Репетитор по математике, ЕГЭ/ОГЭ",
        "bio": "10 лет опыта",
        "subjects": ["Алгебра", "Производные"],
        "hourly_rate": 1500,
        "is_listed": True,
    })
    assert r.status_code == 200, r.text
    assert r.json()["headline"].startswith("Репетитор")

    # профиль теперь возвращается
    me = client.get("/api/tutors/me/profile").json()
    assert me["user_id"] == tutor_user.id
    assert me["subjects"] == ["Алгебра", "Производные"]

    # ученик видит репетитора в каталоге
    _auth(client, student_user)
    catalog = client.get("/api/tutors").json()
    ids = [c["user_id"] for c in catalog]
    assert tutor_user.id in ids
    card = next(c for c in catalog if c["user_id"] == tutor_user.id)
    assert card["connection_status"] == "none"
    assert card["hourly_rate"] == 1500


def test_marketplace_excludes_self_and_unlisted(client, db, tutor_user, student_user):
    _auth(client, tutor_user)
    client.put("/api/tutors/me/profile", json={"headline": "Скрытый профиль", "is_listed": False})
    # сам себя в каталоге не видит + не опубликован
    assert client.get("/api/tutors").json() == []

    # ученик не видит неопубликованного
    _auth(client, student_user)
    assert all(c["user_id"] != tutor_user.id for c in client.get("/api/tutors").json())


def test_connect_and_accept_flow(client, db, tutor_user, student_user):
    _auth(client, tutor_user)
    client.put("/api/tutors/me/profile", json={"headline": "Матан на 100"})

    # ученик отправляет заявку
    _auth(client, student_user)
    r = client.post(f"/api/tutors/{tutor_user.id}/connect")
    assert r.status_code == 200, r.text
    assert r.json()["connection_status"] == "pending"

    # у ученика связь видна как pending
    mine = client.get("/api/me/tutors").json()
    assert len(mine) == 1
    assert mine[0]["tutor_id"] == tutor_user.id
    assert mine[0]["status"] == "pending"

    # повторный connect не плодит дубли
    client.post(f"/api/tutors/{tutor_user.id}/connect")
    assert len(client.get("/api/me/tutors").json()) == 1

    # репетитор видит заявку
    _auth(client, tutor_user)
    students = client.get("/api/tutors/me/students").json()
    assert len(students) == 1
    assert students[0]["student_id"] == student_user.id
    assert students[0]["status"] == "pending"

    # принимает
    r = client.post(f"/api/tutors/me/students/{student_user.id}/accept")
    assert r.status_code == 200
    assert r.json()["status"] == "active"

    # у ученика теперь active
    _auth(client, student_user)
    assert client.get("/api/me/tutors").json()[0]["status"] == "active"

    # и students_count у репетитора учитывает принятого
    card = client.get(f"/api/tutors/{tutor_user.id}").json()
    assert card["students_count"] == 1
    assert card["connection_status"] == "active"


def test_cannot_connect_to_self(client, db, tutor_user):
    _auth(client, tutor_user)
    client.put("/api/tutors/me/profile", json={"headline": "Я"})
    r = client.post(f"/api/tutors/{tutor_user.id}/connect")
    assert r.status_code == 400


def test_connect_to_unknown_tutor_404(client, db, student_user):
    _auth(client, student_user)
    r = client.post("/api/tutors/999999/connect")
    assert r.status_code == 404


def test_accept_missing_request_404(client, db, tutor_user, student_user):
    _auth(client, tutor_user)
    client.put("/api/tutors/me/profile", json={"headline": "Я"})
    r = client.post(f"/api/tutors/me/students/{student_user.id}/accept")
    assert r.status_code == 404


def test_endpoints_require_auth(client):
    client.cookies.clear()
    assert client.get("/api/tutors").status_code == 401
    assert client.get("/api/tutors/me/profile").status_code == 401


def test_student_dashboard_access_control(client, db, tutor_user, student_user):
    _auth(client, tutor_user)
    client.put("/api/tutors/me/profile", json={"headline": "Матан на 100"})
    url = f"/api/tutors/me/students/{student_user.id}/dashboard"

    # нет связи → 403
    assert client.get(url).status_code == 403

    # заявка (pending) — данные всё ещё закрыты
    _auth(client, student_user)
    client.post(f"/api/tutors/{tutor_user.id}/connect")
    _auth(client, tutor_user)
    assert client.get(url).status_code == 403

    # принял → active → доступ есть
    client.post(f"/api/tutors/me/students/{student_user.id}/accept")
    r = client.get(url)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["student"]["student_id"] == student_user.id
    assert "total_points" in body["dashboard"]["activity"]
    assert isinstance(body["dashboard"]["recent_activity"], list)
    assert isinstance(body["dashboard"]["topics_progress"], list)


def test_dashboard_hidden_from_other_tutor(client, db, tutor_user, student_user):
    # активная связь у tutor_user
    _auth(client, tutor_user)
    client.put("/api/tutors/me/profile", json={"headline": "Матан"})
    _auth(client, student_user)
    client.post(f"/api/tutors/{tutor_user.id}/connect")
    _auth(client, tutor_user)
    client.post(f"/api/tutors/me/students/{student_user.id}/accept")

    # посторонний репетитор не видит прогресс чужого ученика
    other = _make_user(db, "tutor-other", "other-tutor@example.com")
    _auth(client, other)
    client.put("/api/tutors/me/profile", json={"headline": "Другой"})
    assert client.get(f"/api/tutors/me/students/{student_user.id}/dashboard").status_code == 403


# --- Фаза 3: задания ---

def _link_active(client, tutor_user, student_user):
    """Создаёт активную связь репетитор↔ученик; оставляет клиента авторизованным репетитором."""
    _auth(client, tutor_user)
    client.put("/api/tutors/me/profile", json={"headline": "Матан на 100"})
    _auth(client, student_user)
    client.post(f"/api/tutors/{tutor_user.id}/connect")
    _auth(client, tutor_user)
    client.post(f"/api/tutors/me/students/{student_user.id}/accept")


def test_assignment_full_flow(client, db, tutor_user, student_user):
    _link_active(client, tutor_user, student_user)
    base = f"/api/tutors/me/students/{student_user.id}/assignments"

    # изначально заданий нет
    assert client.get(base).json() == []

    # репетитор назначает задание-экзамен
    r = client.post(base, json={
        "kind": "exam",
        "title": "ЕГЭ, задание №7",
        "link": "/exam/train?exam=ege&track=profile&task_number=7",
        "note": "Прорешай 5 штук",
    })
    assert r.status_code == 201, r.text
    a = r.json()
    assert a["kind"] == "exam"
    assert a["status"] == "assigned"
    assert a["link"].startswith("/exam/train")

    # репетитор видит задание в списке ученика
    assert len(client.get(base).json()) == 1

    # ученик видит задание у себя, с именем репетитора
    _auth(client, student_user)
    mine = client.get("/api/me/assignments").json()
    assert len(mine) == 1
    assert mine[0]["title"] == "ЕГЭ, задание №7"
    assert mine[0]["tutor_username"] == tutor_user.username

    # ученик отмечает выполненным
    r = client.post(f"/api/me/assignments/{a['id']}/complete")
    assert r.status_code == 200
    assert r.json()["status"] == "done"
    assert r.json()["completed_at"] is not None

    # снимает отметку
    r = client.post(f"/api/me/assignments/{a['id']}/complete?done=false")
    assert r.json()["status"] == "assigned"
    assert r.json()["completed_at"] is None


def test_assignment_requires_active_link(client, db, tutor_user, student_user):
    # только pending-связь — назначать нельзя
    _auth(client, tutor_user)
    client.put("/api/tutors/me/profile", json={"headline": "Матан"})
    _auth(client, student_user)
    client.post(f"/api/tutors/{tutor_user.id}/connect")
    _auth(client, tutor_user)
    base = f"/api/tutors/me/students/{student_user.id}/assignments"
    assert client.post(base, json={"title": "Что-то"}).status_code == 403
    assert client.get(base).status_code == 403


def test_assignment_rejects_external_link(client, db, tutor_user, student_user):
    _link_active(client, tutor_user, student_user)
    base = f"/api/tutors/me/students/{student_user.id}/assignments"
    r = client.post(base, json={"title": "Фишинг", "link": "https://evil.example/x"})
    assert r.status_code == 422


def test_assignment_delete_by_tutor(client, db, tutor_user, student_user):
    _link_active(client, tutor_user, student_user)
    base = f"/api/tutors/me/students/{student_user.id}/assignments"
    a = client.post(base, json={"kind": "custom", "title": "Повтори формулы"}).json()

    # чужой репетитор не может удалить
    other = _make_user(db, "tutor-x", "tutor-x@example.com")
    _auth(client, other)
    assert client.delete(f"/api/tutors/me/assignments/{a['id']}").status_code == 404

    # свой — может
    _auth(client, tutor_user)
    assert client.delete(f"/api/tutors/me/assignments/{a['id']}").status_code == 204
    assert client.get(base).json() == []


def test_student_completes_only_own_assignment(client, db, tutor_user, student_user):
    _link_active(client, tutor_user, student_user)
    base = f"/api/tutors/me/students/{student_user.id}/assignments"
    a = client.post(base, json={"kind": "custom", "title": "Задача"}).json()

    # посторонний ученик не может отметить чужое задание
    stranger = _make_user(db, "stranger", "stranger@example.com")
    _auth(client, stranger)
    assert client.post(f"/api/me/assignments/{a['id']}/complete").status_code == 404
    assert client.get("/api/me/assignments").json() == []


# --- Фаза 5: занятия/конференции ---

def test_session_full_flow(client, db, tutor_user, student_user):
    _link_active(client, tutor_user, student_user)
    base = f"/api/tutors/me/students/{student_user.id}/sessions"

    assert client.get(base).json() == []
    assert client.get("/api/tutors/me/sessions").json() == []

    # репетитор планирует занятие
    r = client.post(base, json={
        "starts_at": "2026-08-01T15:00:00",
        "duration_min": 90,
        "title": "Разбор ЕГЭ №7",
        "meeting_url": "https://meet.example/abc",
        "note": "Подготовь вопросы",
    })
    assert r.status_code == 201, r.text
    s = r.json()
    assert s["title"] == "Разбор ЕГЭ №7"
    assert s["duration_min"] == 90
    assert s["student_username"] == student_user.username

    # видно в календаре репетитора и в списке ученика на странице
    agenda = client.get("/api/tutors/me/sessions").json()
    assert len(agenda) == 1 and agenda[0]["student_id"] == student_user.id
    assert len(client.get(base).json()) == 1

    # ученик видит занятие у себя, с именем репетитора и ссылкой
    _auth(client, student_user)
    mine = client.get("/api/me/sessions").json()
    assert len(mine) == 1
    assert mine[0]["tutor_username"] == tutor_user.username
    assert mine[0]["meeting_url"] == "https://meet.example/abc"

    # отменяет репетитор — исчезает у обоих
    _auth(client, tutor_user)
    assert client.delete(f"/api/tutors/me/sessions/{s['id']}").status_code == 204
    assert client.get("/api/tutors/me/sessions").json() == []
    _auth(client, student_user)
    assert client.get("/api/me/sessions").json() == []


def test_session_update_reschedule(client, db, tutor_user, student_user):
    _link_active(client, tutor_user, student_user)
    base = f"/api/tutors/me/students/{student_user.id}/sessions"
    s = client.post(base, json={
        "starts_at": "2026-08-01T15:00:00",
        "duration_min": 60,
        "title": "Первая тема",
    }).json()

    # перенос: новое время, длительность, тема, ссылка
    r = client.put(f"/api/tutors/me/sessions/{s['id']}", json={
        "starts_at": "2026-08-02T16:30:00",
        "duration_min": 90,
        "title": "Перенесённая тема",
        "meeting_url": "https://meet.example/xyz",
    })
    assert r.status_code == 200, r.text
    upd = r.json()
    assert upd["id"] == s["id"]
    assert upd["duration_min"] == 90
    assert upd["title"] == "Перенесённая тема"
    assert upd["starts_at"].startswith("2026-08-02T16:30:00")
    assert upd["meeting_url"] == "https://meet.example/xyz"

    # ученик видит обновлённое время
    _auth(client, student_user)
    mine = client.get("/api/me/sessions").json()
    assert len(mine) == 1 and mine[0]["title"] == "Перенесённая тема"

    # плохая ссылка отклоняется
    _auth(client, tutor_user)
    bad = client.put(f"/api/tutors/me/sessions/{s['id']}", json={
        "starts_at": "2026-08-02T16:30:00", "meeting_url": "javascript:alert(1)",
    })
    assert bad.status_code == 422

    # чужой репетитор не может переносить
    other = _make_user(db, "tutor-w", "tutor-w@example.com")
    _auth(client, other)
    assert client.put(f"/api/tutors/me/sessions/{s['id']}",
                      json={"starts_at": "2026-08-03T10:00:00"}).status_code == 404


def test_session_requires_active_link(client, db, tutor_user, student_user):
    _auth(client, tutor_user)
    client.put("/api/tutors/me/profile", json={"headline": "Матан"})
    _auth(client, student_user)
    client.post(f"/api/tutors/{tutor_user.id}/connect")
    _auth(client, tutor_user)
    base = f"/api/tutors/me/students/{student_user.id}/sessions"
    assert client.post(base, json={"starts_at": "2026-08-01T15:00:00"}).status_code == 403
    assert client.get(base).status_code == 403


def test_session_rejects_bad_meeting_url(client, db, tutor_user, student_user):
    _link_active(client, tutor_user, student_user)
    base = f"/api/tutors/me/students/{student_user.id}/sessions"
    r = client.post(base, json={"starts_at": "2026-08-01T15:00:00", "meeting_url": "javascript:alert(1)"})
    assert r.status_code == 422


def test_session_agenda_sorted_and_cancel_scope(client, db, tutor_user, student_user):
    _link_active(client, tutor_user, student_user)
    base = f"/api/tutors/me/students/{student_user.id}/sessions"
    s_late = client.post(base, json={"starts_at": "2026-09-10T10:00:00", "title": "Позже"}).json()
    s_early = client.post(base, json={"starts_at": "2026-08-05T10:00:00", "title": "Раньше"}).json()

    # агенда отсортирована по времени по возрастанию
    agenda = client.get("/api/tutors/me/sessions").json()
    assert [x["title"] for x in agenda] == ["Раньше", "Позже"]

    # чужой репетитор не может отменить занятие
    other = _make_user(db, "tutor-z", "tutor-z@example.com")
    _auth(client, other)
    assert client.delete(f"/api/tutors/me/sessions/{s_early['id']}").status_code == 404
    _ = s_late  # оба созданы, порядок проверен выше


# --- Фаза 4: свой контент репетитора ---

def test_content_crud(client, db, tutor_user):
    _auth(client, tutor_user)
    assert client.get("/api/tutors/me/content").json() == []

    # создать задачу
    r = client.post("/api/tutors/me/content", json={
        "kind": "task",
        "title": "Своя задача про параболу",
        "body": "Найдите вершину параболы y=x^2-4x+3",
        "answer": "(2, -1)",
    })
    assert r.status_code == 201, r.text
    c = r.json()
    assert c["kind"] == "task" and c["answer"] == "(2, -1)"

    # список
    assert len(client.get("/api/tutors/me/content").json()) == 1

    # редактировать
    r = client.put(f"/api/tutors/me/content/{c['id']}", json={
        "kind": "material", "title": "Конспект: производная", "body": "Правила дифференцирования…",
    })
    assert r.status_code == 200
    assert r.json()["kind"] == "material" and r.json()["title"].startswith("Конспект")

    # удалить
    assert client.delete(f"/api/tutors/me/content/{c['id']}").status_code == 204
    assert client.get("/api/tutors/me/content").json() == []


def test_content_rejects_external_attachment(client, db, tutor_user):
    _auth(client, tutor_user)
    r = client.post("/api/tutors/me/content", json={"title": "Файл", "attachment_url": "ftp://x/y"})
    assert r.status_code == 422


def test_content_view_access_control(client, db, tutor_user, student_user):
    _auth(client, tutor_user)
    client.put("/api/tutors/me/profile", json={"headline": "Матан"})
    c = client.post("/api/tutors/me/content", json={"title": "Материал", "body": "текст"}).json()
    url = f"/api/tutors/content/{c['id']}"

    # автор видит
    assert client.get(url).status_code == 200

    # посторонний (нет связи) — 403
    _auth(client, student_user)
    assert client.get(url).status_code == 403

    # заявка (pending) — всё ещё 403
    client.post(f"/api/tutors/{tutor_user.id}/connect")
    assert client.get(url).status_code == 403

    # приняли → active → ученик видит, с именем автора
    _auth(client, tutor_user)
    client.post(f"/api/tutors/me/students/{student_user.id}/accept")
    _auth(client, student_user)
    r = client.get(url)
    assert r.status_code == 200
    assert r.json()["tutor_username"] == tutor_user.username


def test_assign_material_from_library(client, db, tutor_user, student_user):
    _link_active(client, tutor_user, student_user)
    c = client.post("/api/tutors/me/content", json={"title": "Домашняя подборка", "body": "5 задач"}).json()

    # назначаем материал ученику как задание kind=material со ссылкой на просмотрщик
    base = f"/api/tutors/me/students/{student_user.id}/assignments"
    r = client.post(base, json={
        "kind": "material",
        "title": "Материал: Домашняя подборка",
        "link": f"/tutors/material/{c['id']}",
    })
    assert r.status_code == 201, r.text
    assert r.json()["kind"] == "material"

    # ученик видит задание, ссылка ведёт на материал, который ему доступен
    _auth(client, student_user)
    mine = client.get("/api/me/assignments").json()
    assert mine[0]["kind"] == "material"
    assert mine[0]["link"] == f"/tutors/material/{c['id']}"
    assert client.get(f"/api/tutors/content/{c['id']}").status_code == 200
