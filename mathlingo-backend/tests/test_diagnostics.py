"""
R2 task 3: диагностика — куратор собирает набор уже опубликованных заданий
темы, ученик проходит его целиком, ответы пишутся в attempts как
content_type="diagnostic" и подхватываются тем же mastery.recompute(),
что и обычные задания (см. tests/test_mastery_service.py).
"""
from tests.conftest import authorization_header


def _make_skill_row(db, subject, code="diag-skill"):
    from app.models import Skill

    skill = Skill(subject_id=subject.id, name="Skill", code=code)
    db.add(skill)
    db.commit()
    db.refresh(skill)
    return skill


def _make_published_task(db, subject, skill, correct_answer="42", **overrides):
    from app.models import Task

    defaults = dict(
        title="t", subject=subject.code, subject_id=subject.id, skill_id=skill.id,
        status="published", answer_type="single_answer", correct_answer=correct_answer,
        content="<p>q</p>", reward_points=5,
    )
    defaults.update(overrides)
    task = Task(**defaults)
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


# --- Admin authoring ---

def test_teacher_cannot_create_diagnostic(client, teacher_admin, db, subject):
    skill = _make_skill_row(db, subject)
    task = _make_published_task(db, subject, skill)

    response = client.post(
        "/admin/diagnostics",
        headers=authorization_header(teacher_admin),
        json={"skill_id": skill.id, "task_ids": [task.id]},
    )
    assert response.status_code == 403


def test_content_manager_can_create_diagnostic(client, content_manager_admin, db, subject):
    skill = _make_skill_row(db, subject)
    t1 = _make_published_task(db, subject, skill)
    t2 = _make_published_task(db, subject, skill)

    response = client.post(
        "/admin/diagnostics",
        headers=authorization_header(content_manager_admin),
        json={"skill_id": skill.id, "task_ids": [t1.id, t2.id]},
    )
    assert response.status_code == 200
    assert response.json()["task_ids"] == [t1.id, t2.id]
    assert response.json()["is_active"] is True


def test_create_diagnostic_rejects_unpublished_task(client, content_manager_admin, db, subject):
    skill = _make_skill_row(db, subject)
    draft = _make_published_task(db, subject, skill, status="draft")

    response = client.post(
        "/admin/diagnostics",
        headers=authorization_header(content_manager_admin),
        json={"skill_id": skill.id, "task_ids": [draft.id]},
    )
    assert response.status_code == 400


def test_create_diagnostic_rejects_task_from_wrong_skill(client, content_manager_admin, db, subject):
    skill_a = _make_skill_row(db, subject, code="skill-a")
    skill_b = _make_skill_row(db, subject, code="skill-b")
    task = _make_published_task(db, subject, skill_a)

    response = client.post(
        "/admin/diagnostics",
        headers=authorization_header(content_manager_admin),
        json={"skill_id": skill_b.id, "task_ids": [task.id]},
    )
    assert response.status_code == 400


def test_create_diagnostic_rejects_empty_task_list(client, content_manager_admin, db, subject):
    skill = _make_skill_row(db, subject)

    response = client.post(
        "/admin/diagnostics",
        headers=authorization_header(content_manager_admin),
        json={"skill_id": skill.id, "task_ids": []},
    )
    assert response.status_code == 400


def test_update_diagnostic_task_ids(client, content_manager_admin, db, subject):
    skill = _make_skill_row(db, subject)
    t1 = _make_published_task(db, subject, skill)
    t2 = _make_published_task(db, subject, skill)
    headers = authorization_header(content_manager_admin)

    created = client.post(
        "/admin/diagnostics", headers=headers, json={"skill_id": skill.id, "task_ids": [t1.id]}
    ).json()

    response = client.put(
        f"/admin/diagnostics/{created['id']}",
        headers=headers,
        json={"task_ids": [t1.id, t2.id]},
    )
    assert response.status_code == 200
    assert response.json()["task_ids"] == [t1.id, t2.id]


def test_list_diagnostics_filtered_by_skill(client, content_manager_admin, db, subject):
    skill_a = _make_skill_row(db, subject, code="skill-a")
    skill_b = _make_skill_row(db, subject, code="skill-b")
    ta = _make_published_task(db, subject, skill_a)
    tb = _make_published_task(db, subject, skill_b)
    headers = authorization_header(content_manager_admin)

    client.post("/admin/diagnostics", headers=headers, json={"skill_id": skill_a.id, "task_ids": [ta.id]})
    client.post("/admin/diagnostics", headers=headers, json={"skill_id": skill_b.id, "task_ids": [tb.id]})

    response = client.get("/admin/diagnostics", headers=headers, params={"skill_id": skill_a.id})
    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["skill_id"] == skill_a.id


# --- Student-facing ---

def test_get_skill_diagnostic_excludes_correct_answer_and_preserves_order(client, user, db, subject):
    from app.auth import create_access_token
    from app.models import Diagnostic

    skill = _make_skill_row(db, subject)
    t1 = _make_published_task(db, subject, skill, title="first")
    t2 = _make_published_task(db, subject, skill, title="second")
    diagnostic = Diagnostic(skill_id=skill.id, task_ids=[t2.id, t1.id])  # намеренно не по id
    db.add(diagnostic)
    db.commit()

    token = create_access_token({"sub": user.email})
    response = client.get(
        f"/gamification/skills/{skill.id}/diagnostic",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    body = response.json()
    assert [t["title"] for t in body["tasks"]] == ["second", "first"]
    assert all("correct_answer" not in t for t in body["tasks"])


def test_get_skill_diagnostic_404_when_none_active(client, user, subject):
    from app.auth import create_access_token

    token = create_access_token({"sub": user.email})
    response = client.get(
        f"/gamification/skills/999/diagnostic",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 404


def test_submit_diagnostic_records_attempts_and_returns_mastery(client, user, db, subject):
    from app.auth import create_access_token
    from app.models import Attempt, Diagnostic, MasteryState

    skill = _make_skill_row(db, subject)
    t1 = _make_published_task(db, subject, skill, correct_answer="1")
    t2 = _make_published_task(db, subject, skill, correct_answer="2")
    diagnostic = Diagnostic(skill_id=skill.id, task_ids=[t1.id, t2.id])
    db.add(diagnostic)
    db.commit()
    db.refresh(diagnostic)

    token = create_access_token({"sub": user.email})
    response = client.post(
        f"/gamification/diagnostics/{diagnostic.id}/submit",
        headers={"Authorization": f"Bearer {token}"},
        json={"answers": [
            {"task_id": t1.id, "answer": "1"},
            {"task_id": t2.id, "answer": "wrong"},
        ]},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["correct_count"] == 1
    assert body["total_count"] == 2
    assert body["mastery"]["sample_size"] == 2
    assert body["mastery"]["skill_id"] == skill.id

    attempts = db.query(Attempt).filter(Attempt.content_type == "diagnostic").all()
    assert len(attempts) == 2
    assert all(a.content_id == diagnostic.id for a in attempts)

    state = db.query(MasteryState).filter(
        MasteryState.user_id == user.id, MasteryState.skill_id == skill.id
    ).one()
    assert state.sample_size == 2


def test_submit_diagnostic_rejects_task_not_in_diagnostic(client, user, db, subject):
    from app.auth import create_access_token
    from app.models import Diagnostic

    skill = _make_skill_row(db, subject)
    t1 = _make_published_task(db, subject, skill)
    other_task = _make_published_task(db, subject, skill)
    diagnostic = Diagnostic(skill_id=skill.id, task_ids=[t1.id])
    db.add(diagnostic)
    db.commit()
    db.refresh(diagnostic)

    token = create_access_token({"sub": user.email})
    response = client.post(
        f"/gamification/diagnostics/{diagnostic.id}/submit",
        headers={"Authorization": f"Bearer {token}"},
        json={"answers": [{"task_id": other_task.id, "answer": "x"}]},
    )
    assert response.status_code == 400


def test_submit_diagnostic_requires_authentication(client, db, subject):
    from app.models import Diagnostic

    skill = _make_skill_row(db, subject)
    task = _make_published_task(db, subject, skill)
    diagnostic = Diagnostic(skill_id=skill.id, task_ids=[task.id])
    db.add(diagnostic)
    db.commit()
    db.refresh(diagnostic)

    response = client.post(
        f"/gamification/diagnostics/{diagnostic.id}/submit",
        json={"answers": [{"task_id": task.id, "answer": "x"}]},
    )
    assert response.status_code == 401
