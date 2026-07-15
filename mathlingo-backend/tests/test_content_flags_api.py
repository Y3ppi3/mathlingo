"""
HTTP/RBAC-тесты пост-публикационного мониторинга (R2 task 7): жалобы,
разбор флагов, аналитика качества и ручной return-to-review. Отдельно —
сквозной интеграционный тест: несколько неверных ответов ученика подряд
по AI-заданию должны сами вернуть его в in_review через реальный
/gamification/submit-answer, а не только через прямой вызов сервиса
(см. tests/test_content_quality.py — там то же самое, но на уровне
сервиса, без HTTP).
"""
from tests.conftest import authorization_header


def _make_ai_task(db, subject, **overrides):
    from app.models import Task

    defaults = dict(
        title="AI task", subject=subject.code, subject_id=subject.id,
        status="published", source="ai", answer_type="single_answer",
        content="<p>2+2=?</p>", correct_answer="4", reward_points=5,
    )
    defaults.update(overrides)
    task = Task(**defaults)
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def _make_skill_row(db, subject):
    from app.models import Skill

    skill = Skill(subject_id=subject.id, name="skill", code="skill-q7")
    db.add(skill)
    db.commit()
    db.refresh(skill)
    return skill


# --- Жалобы ---

def test_teacher_can_file_complaint(client, teacher_admin, db, subject):
    task = _make_ai_task(db, subject)
    response = client.post(
        f"/admin/tasks/{task.id}/flags",
        headers=authorization_header(teacher_admin),
        json={"comment": "Ответ неверный по учебнику"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["flag_type"] == "complaint"
    assert body["status"] == "open"
    assert body["details"]["comment"] == "Ответ неверный по учебнику"
    assert body["created_by_admin_id"] == teacher_admin.id


def test_complaint_on_missing_task_404(client, teacher_admin):
    response = client.post(
        "/admin/tasks/999999/flags",
        headers=authorization_header(teacher_admin),
        json={"comment": "x"},
    )
    assert response.status_code == 404


def test_complaint_requires_authentication(client, db, subject):
    task = _make_ai_task(db, subject)
    response = client.post(f"/admin/tasks/{task.id}/flags", json={"comment": "x"})
    assert response.status_code == 401


# --- Список флагов ---

def test_list_content_flags_filters_by_status(client, teacher_admin, content_manager_admin, db, subject):
    task = _make_ai_task(db, subject)
    client.post(
        f"/admin/tasks/{task.id}/flags",
        headers=authorization_header(teacher_admin),
        json={"comment": "жалоба 1"},
    )
    flag_id = client.post(
        f"/admin/tasks/{task.id}/flags",
        headers=authorization_header(teacher_admin),
        json={"comment": "жалоба 2"},
    ).json()["id"]
    client.put(
        f"/admin/content-flags/{flag_id}",
        headers=authorization_header(content_manager_admin),
        json={"status": "dismissed"},
    )

    open_flags = client.get(
        "/admin/content-flags",
        headers=authorization_header(teacher_admin),
        params={"status_filter": "open"},
    )
    assert open_flags.status_code == 200
    assert len(open_flags.json()) == 1

    dismissed_flags = client.get(
        "/admin/content-flags",
        headers=authorization_header(teacher_admin),
        params={"status_filter": "dismissed"},
    )
    assert len(dismissed_flags.json()) == 1


# --- Разбор флага ---

def test_resolve_flag_sets_resolver_and_timestamp(client, teacher_admin, content_manager_admin, db, subject):
    task = _make_ai_task(db, subject)
    flag_id = client.post(
        f"/admin/tasks/{task.id}/flags",
        headers=authorization_header(teacher_admin),
        json={"comment": "жалоба"},
    ).json()["id"]

    response = client.put(
        f"/admin/content-flags/{flag_id}",
        headers=authorization_header(content_manager_admin),
        json={"status": "resolved"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "resolved"
    assert body["resolved_by_admin_id"] == content_manager_admin.id
    assert body["resolved_at"] is not None


def test_cannot_resolve_already_closed_flag(client, teacher_admin, content_manager_admin, db, subject):
    task = _make_ai_task(db, subject)
    flag_id = client.post(
        f"/admin/tasks/{task.id}/flags",
        headers=authorization_header(teacher_admin),
        json={"comment": "жалоба"},
    ).json()["id"]
    client.put(
        f"/admin/content-flags/{flag_id}",
        headers=authorization_header(content_manager_admin),
        json={"status": "dismissed"},
    )

    second = client.put(
        f"/admin/content-flags/{flag_id}",
        headers=authorization_header(content_manager_admin),
        json={"status": "resolved"},
    )
    assert second.status_code == 409


# --- Аналитика качества ---

def test_quality_overview_lists_ai_tasks_only(client, teacher_admin, db, subject):
    ai_task = _make_ai_task(db, subject, title="ai one")
    from app.models import Task
    manual_task = Task(
        title="manual one", subject=subject.code, subject_id=subject.id,
        status="published", source="manual", answer_type="single_answer",
        content="<p>x</p>", correct_answer="1",
    )
    db.add(manual_task)
    db.commit()

    response = client.get("/admin/quality/ai-tasks", headers=authorization_header(teacher_admin))
    assert response.status_code == 200
    ids = [row["task_id"] for row in response.json()]
    assert ai_task.id in ids
    assert manual_task.id not in ids


def test_quality_overview_requires_authentication(client, db, subject):
    _make_ai_task(db, subject)
    response = client.get("/admin/quality/ai-tasks")
    assert response.status_code == 401


# --- Ручной return-to-review ---

def test_content_manager_can_return_published_task_to_review(client, content_manager_admin, db, subject):
    task = _make_ai_task(db, subject)
    response = client.post(
        f"/admin/tasks/{task.id}/return-to-review",
        headers=authorization_header(content_manager_admin),
    )
    assert response.status_code == 200
    assert response.json()["status"] == "in_review"


def test_teacher_cannot_return_task_to_review(client, teacher_admin, db, subject):
    task = _make_ai_task(db, subject)
    response = client.post(
        f"/admin/tasks/{task.id}/return-to-review",
        headers=authorization_header(teacher_admin),
    )
    assert response.status_code == 403


def test_cannot_return_a_draft_task_to_review(client, content_manager_admin, db, subject):
    task = _make_ai_task(db, subject, status="draft")
    response = client.post(
        f"/admin/tasks/{task.id}/return-to-review",
        headers=authorization_header(content_manager_admin),
    )
    assert response.status_code == 409


# --- Сквозной сценарий: аномалия через реальный submit-answer ---

def test_repeated_wrong_answers_auto_revert_ai_task_via_submit_answer(client, user, db, subject):
    from app.auth import create_access_token
    from app.services import content_quality

    skill = _make_skill_row(db, subject)
    task = _make_ai_task(db, subject, skill_id=skill.id)
    token = create_access_token({"sub": user.email})
    headers = {"Authorization": f"Bearer {token}"}

    for _ in range(content_quality.MIN_SAMPLE_SIZE):
        response = client.post(
            "/gamification/submit-answer",
            headers=headers,
            json={"task_id": task.id, "answer": "wrong"},
        )
        assert response.status_code == 200

    db.refresh(task)
    assert task.status == "in_review"

    # Задание больше не доступно ученику для решения.
    blocked = client.post(
        "/gamification/submit-answer",
        headers=headers,
        json={"task_id": task.id, "answer": "4"},
    )
    assert blocked.status_code == 409

    from app.models import ContentFlag
    flags = db.query(ContentFlag).filter(ContentFlag.task_id == task.id).all()
    assert len(flags) == 1
    assert flags[0].flag_type == "anomaly"
