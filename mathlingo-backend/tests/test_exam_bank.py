"""
Ф1 контент-бэкбона банка ЕГЭ/ОГЭ: модель ExamTask, портируемые контент-паки
(экспорт/импорт с дедупом по external_id), выдача студенту с пагинацией и
скрытыми ответами, статистика в админке.
"""
from app.auth import create_access_token
from app.models import ExamTask
from app.services import content_pack
from tests.conftest import authorization_header


def _student_header(user):
    return {"Authorization": f"Bearer {create_access_token({'sub': user.email})}"}


def _seed(db, **kw):
    defaults = dict(exam="oge", track=None, task_number=1, topic="Арифметика",
                    difficulty=1, statement="2+2?", answer_type="single_answer",
                    answer="4", source="manual")
    defaults.update(kw)
    t = ExamTask(**defaults)
    db.add(t)
    db.commit()
    db.refresh(t)
    return t


SAMPLE_PACK = (
    '{"_pack": {"format": "mathlingo-exam-pack", "version": 1}}\n'
    '{"exam": "oge", "task_number": 1, "topic": "Арифметика", "statement": "12 + 7·3?", "answer": "33", "external_id": "p-1"}\n'
    '{"exam": "ege", "track": "profile", "task_number": 7, "topic": "Производная", "statement": "f(x)=x^2, f\'(3)?", "answer": "6", "external_id": "p-2"}\n'
    'битая строка не json\n'
)


# --- Контент-паки ---

def test_import_pack_counts_and_skips_bad(client, db):
    result = content_pack.import_pack(db, SAMPLE_PACK)
    assert result["imported"] == 2
    assert result["updated"] == 0
    assert result["skipped"] == 1   # битая строка
    assert db.query(ExamTask).count() == 2


def test_import_is_idempotent_by_external_id(client, db):
    content_pack.import_pack(db, SAMPLE_PACK)
    # Повторный импорт того же пака не плодит дублей — обновляет.
    result = content_pack.import_pack(db, SAMPLE_PACK)
    assert result["imported"] == 0
    assert result["updated"] == 2
    assert db.query(ExamTask).count() == 2


def test_export_then_import_roundtrip(client, db):
    _seed(db, external_id="e-1", answer="4")
    _seed(db, exam="ege", track="base", task_number=2, topic="Дроби",
          statement="3/4+1/4?", answer="1", external_id="e-2")

    pack = content_pack.export_pack(db)
    assert '"_pack"' in pack.splitlines()[0]

    # Импортируем в «пустую» БД (эмулируем перенос): чистим и накатываем пак.
    db.query(ExamTask).delete()
    db.commit()
    result = content_pack.import_pack(db, pack)
    assert result["imported"] == 2
    assert {t.external_id for t in db.query(ExamTask).all()} == {"e-1", "e-2"}


def test_export_filters_by_exam(client, db):
    _seed(db, exam="oge", external_id="o-1")
    _seed(db, exam="ege", track="profile", external_id="g-1")
    pack = content_pack.export_pack(db, exam="ege")
    # Манифест + ровно одно задание ege.
    lines = [l for l in pack.splitlines() if l.strip()]
    assert len(lines) == 2
    assert '"ege"' in lines[1] and 'oge' not in lines[1]


# --- Выдача студенту ---

def test_list_tasks_paginates_and_hides_answers(client, user, db):
    for i in range(25):
        _seed(db, task_number=i + 1, statement=f"q{i}", answer=str(i), external_id=f"s-{i}")

    resp = client.get("/api/exam/tasks", headers=_student_header(user), params={"limit": 10})
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 25
    assert len(body["items"]) == 10
    # Ответ и разбор НЕ должны утекать студенту.
    assert "answer" not in body["items"][0]
    assert "solution" not in body["items"][0]


def test_list_tasks_filters(client, user, db):
    _seed(db, exam="oge", task_number=1, external_id="f-1")
    _seed(db, exam="ege", track="profile", task_number=7, topic="Производная", external_id="f-2")

    ege = client.get("/api/exam/tasks", headers=_student_header(user),
                     params={"exam": "ege", "track": "profile"}).json()
    assert ege["total"] == 1
    assert ege["items"][0]["topic"] == "Производная"


def test_topics_facets(client, user, db):
    _seed(db, exam="oge", task_number=1, topic="Арифметика", external_id="t-1")
    _seed(db, exam="oge", task_number=1, topic="Арифметика", external_id="t-2")
    _seed(db, exam="oge", task_number=6, topic="Уравнения", external_id="t-3")

    facets = client.get("/api/exam/topics", headers=_student_header(user),
                        params={"exam": "oge"}).json()
    by_topic = {f["topic"]: f["count"] for f in facets}
    assert by_topic["Арифметика"] == 2
    assert by_topic["Уравнения"] == 1


def test_get_task_404_and_auth(client, user):
    assert client.get("/api/exam/tasks/999999", headers=_student_header(user)).status_code == 404
    assert client.get("/api/exam/tasks").status_code == 401


# --- Админка: импорт/экспорт/стата ---

def test_admin_import_export_stats(client, admin, db):
    hdr = authorization_header(admin)

    imp = client.post("/admin/exam/import", headers=hdr,
                      files={"file": ("pack.ndjson", SAMPLE_PACK, "application/x-ndjson")})
    assert imp.status_code == 200
    assert imp.json()["imported"] == 2

    stats = client.get("/admin/exam/stats", headers=hdr).json()
    assert stats["total"] == 2
    assert stats["by_exam"]["oge"] == 1 and stats["by_exam"]["ege"] == 1

    export = client.get("/admin/exam/export", headers=hdr, params={"exam": "oge"})
    assert export.status_code == 200
    assert "p-1" in export.text and "p-2" not in export.text


def test_admin_exam_requires_admin(client, user):
    resp = client.post("/admin/exam/import", headers=_student_header(user),
                       files={"file": ("p.ndjson", SAMPLE_PACK, "application/x-ndjson")})
    assert resp.status_code in (401, 403)
