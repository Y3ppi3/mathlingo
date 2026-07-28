"""
Ф2: AI-генерация банка (пока процедурные оригинальные шаблоны, без LLM).
Проверяем поведение (счётчики/дедуп/фильтры/эндпоинт) и КОРРЕКТНОСТЬ формул —
ответ пересчитываем независимо по параметрам из signature.
"""
import random

from app.auth import create_access_token
from app.models import ExamTask
from app.services import exam_generator
from tests.conftest import authorization_header


def _student_header(user):
    return {"Authorization": f"Bearer {create_access_token({'sub': user.email})}"}


# Независимый пересчёт ответа по signature (a-b-c...) — ловит рассинхрон
# условия и ответа в шаблоне.
def _expected(key, sig):
    p = [int(x) for x in sig.split("-")]
    if key == "oge-arith":       # a + b·c
        return str(p[0] + p[1] * p[2])
    if key == "oge-lineq":       # x − a = b  →  x = a + b
        return str(p[0] + p[1])
    if key == "oge-percent":     # p дешевеет на k%
        return str(int(p[0] * (100 - p[1]) / 100))
    if key == "egep-deriv":      # f=ax²+bx, f'(x0)=2a·x0+b
        return str(2 * p[0] * p[2] + p[1])
    return None


def test_templates_answers_are_correct():
    rng = random.Random(1)
    checked = 0
    for tmpl in exam_generator.TEMPLATES:
        for _ in range(5):
            task = exam_generator.generate_one(tmpl, rng)
            sig = task["external_id"].split(f"ai-{tmpl.key}-", 1)[1]
            exp = _expected(tmpl.key, sig)
            if exp is not None:
                assert task["answer"] == exp, f"{tmpl.key}: {task['statement']} -> {task['answer']} != {exp}"
                checked += 1
            assert task["statement"] and task["source"] == "ai"
    assert checked > 0


def test_generate_creates_distinct_ai_tasks(client, db):
    res = exam_generator.generate(db, exam="oge", count=10, seed=42)
    assert res["created"] == 10
    tasks = db.query(ExamTask).all()
    assert len(tasks) == 10
    assert all(t.source == "ai" and t.exam == "oge" for t in tasks)
    assert all(t.answer and t.statement for t in tasks)


def test_generate_dedup_on_repeat(client, db):
    exam_generator.generate(db, exam="oge", count=8, seed=7)
    before = db.query(ExamTask).count()
    # Тот же seed — те же параметры → в основном дубликаты, счётчик не растёт кратно.
    res = exam_generator.generate(db, exam="oge", count=8, seed=7)
    after = db.query(ExamTask).count()
    assert res["duplicates"] >= 1
    assert after - before == res["created"]


def test_generate_filters_by_track(client, db):
    exam_generator.generate(db, exam="ege", track="profile", count=6, seed=3)
    tasks = db.query(ExamTask).all()
    assert tasks and all(t.exam == "ege" and t.track == "profile" for t in tasks)


def test_generate_no_matching_templates(client, db):
    # У ОГЭ нет трека profile — шаблонов нет.
    res = exam_generator.generate(db, exam="oge", track="profile", count=5)
    assert res["created"] == 0
    assert db.query(ExamTask).count() == 0


def test_generate_endpoint_creates_and_shows_in_stats(client, admin, db):
    hdr = authorization_header(admin)
    resp = client.post("/admin/exam/generate", headers=hdr,
                       json={"exam": "ege", "track": "profile", "count": 5, "seed": 11})
    assert resp.status_code == 200
    assert resp.json()["created"] == 5

    stats = client.get("/admin/exam/stats", headers=hdr).json()
    assert stats["by_source"].get("ai") == 5


def test_generate_endpoint_requires_admin(client, user):
    resp = client.post("/admin/exam/generate", headers=_student_header(user),
                       json={"exam": "oge", "count": 3})
    assert resp.status_code in (401, 403)
