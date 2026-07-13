"""
R2 task 1 prerequisite: до этого POST /gamification/task-groups/{id}/data и
/submit-answer не существовали вообще (404), хотя TaskSolver.tsx их уже
вызывал. Эти тесты проверяют реально работающий флоу: контентная модель
(content/answer_type/options/correct_answer) -> задание опубликовано ->
ученик решает -> запись в attempts + начисление очков.
"""
from tests.conftest import authorization_header


def _make_published_task(db, subject, **overrides):
    from app.models import Task

    defaults = dict(
        title="2x derivative",
        subject=subject.code,
        subject_id=subject.id,
        status="published",
        answer_type="single_answer",
        content="<p>Find the derivative of x^2</p>",
        correct_answer="2x",
        reward_points=10,
        estimated_time_seconds=60,
    )
    defaults.update(overrides)
    task = Task(**defaults)
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def _make_task_group(db, subject):
    from app.models import AdventureMap, MapLocation, TaskGroup

    adventure_map = AdventureMap(name="Map", subject_id=subject.id)
    db.add(adventure_map)
    db.commit()
    db.refresh(adventure_map)

    location = MapLocation(name="Loc", position_x=0, position_y=0, adventure_map_id=adventure_map.id)
    db.add(location)
    db.commit()
    db.refresh(location)

    group = TaskGroup(name="Group", location_id=location.id)
    db.add(group)
    db.commit()
    db.refresh(group)
    return group


# --- Content model (admin authoring) ---

def test_create_multiple_choice_task(client, content_manager_admin, subject):
    response = client.post(
        "/admin/tasks",
        headers=authorization_header(content_manager_admin),
        json={
            "title": "MC task",
            "subject": subject.code,
            "answer_type": "multiple_choice",
            "content": "<p>2+2=?</p>",
            "options": ["3", "4", "5"],
            "correct_answer": "1",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["answer_type"] == "multiple_choice"
    assert body["options"] == ["3", "4", "5"]
    assert body["correct_answer"] == "1"


def test_multiple_choice_correct_answer_out_of_range_rejected(client, content_manager_admin, subject):
    response = client.post(
        "/admin/tasks",
        headers=authorization_header(content_manager_admin),
        json={
            "title": "MC task",
            "subject": subject.code,
            "answer_type": "multiple_choice",
            "options": ["3", "4"],
            "correct_answer": "5",
        },
    )
    assert response.status_code == 400


def test_update_task_content_while_draft(client, content_manager_admin, subject):
    created = client.post(
        "/admin/tasks",
        headers=authorization_header(content_manager_admin),
        json={"title": "x", "subject": subject.code},
    ).json()

    response = client.put(
        f"/admin/tasks/{created['id']}",
        headers=authorization_header(content_manager_admin),
        json={"content": "<p>Updated</p>", "correct_answer": "42"},
    )
    assert response.status_code == 200
    assert response.json()["content"] == "<p>Updated</p>"
    assert response.json()["correct_answer"] == "42"


# --- Student-facing fetch (must not leak correct_answer) ---

def test_task_group_data_excludes_correct_answer(client, user, db, subject):
    task = _make_published_task(db, subject)
    group = _make_task_group(db, subject)
    task.task_group_id = group.id
    db.commit()

    from app.auth import create_access_token

    token = create_access_token({"sub": user.email})
    response = client.post(
        f"/gamification/task-groups/{group.id}/data",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["tasks"][0]["id"] == task.id
    assert "correct_answer" not in body["tasks"][0]
    assert body["tasks"][0]["content"] == task.content


def test_task_group_data_excludes_unpublished_tasks(client, user, db, subject):
    group = _make_task_group(db, subject)
    draft = _make_published_task(db, subject, title="draft one", status="draft")
    draft.task_group_id = group.id
    db.commit()

    from app.auth import create_access_token

    token = create_access_token({"sub": user.email})
    response = client.post(
        f"/gamification/task-groups/{group.id}/data",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    assert response.json()["tasks"] == []


# --- Submission ---

def test_submit_correct_single_answer_awards_points_and_records_attempt(client, user, db, subject):
    from app.models import Attempt, UserProgress
    from app.auth import create_access_token

    task = _make_published_task(db, subject)
    db.add(UserProgress(user_id=user.id, current_level=1, total_points=0))
    db.commit()

    token = create_access_token({"sub": user.email})
    response = client.post(
        "/gamification/submit-answer",
        headers={"Authorization": f"Bearer {token}"},
        json={"task_id": task.id, "answer": "  2X  ", "time_spent_ms": 4200, "hints_used": 1},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["isCorrect"] is True
    assert body["points"] == 10

    attempt = db.query(Attempt).filter(Attempt.content_id == task.id).one()
    assert attempt.user_id == user.id
    assert attempt.is_correct is True
    assert attempt.time_spent_ms == 4200
    assert attempt.hints_used == 1
    assert attempt.content_type == "task"
    assert attempt.source == "manual"

    progress = db.query(UserProgress).filter(UserProgress.user_id == user.id).one()
    assert progress.total_points == 10


def test_submit_creates_user_progress_if_missing(client, user, db, subject):
    # UserProgress раньше создавался лениво только в get_map_data — если
    # ученик решает задание, ни разу не открыв карту, строки могло не быть
    # вообще, и очки терялись молча (isCorrect=true в ответе, но нигде не
    # сохранено).
    from app.models import UserProgress
    from app.auth import create_access_token

    assert db.query(UserProgress).filter(UserProgress.user_id == user.id).first() is None

    task = _make_published_task(db, subject)
    token = create_access_token({"sub": user.email})
    response = client.post(
        "/gamification/submit-answer",
        headers={"Authorization": f"Bearer {token}"},
        json={"task_id": task.id, "answer": "2x"},
    )

    assert response.status_code == 200
    progress = db.query(UserProgress).filter(UserProgress.user_id == user.id).one()
    assert progress.total_points == 10


def test_submit_incorrect_answer_records_attempt_without_points(client, user, db, subject):
    from app.models import Attempt

    task = _make_published_task(db, subject)
    from app.auth import create_access_token

    token = create_access_token({"sub": user.email})
    response = client.post(
        "/gamification/submit-answer",
        headers={"Authorization": f"Bearer {token}"},
        json={"task_id": task.id, "answer": "wrong"},
    )

    assert response.status_code == 200
    assert response.json()["isCorrect"] is False
    assert response.json()["points"] == 0

    attempt = db.query(Attempt).filter(Attempt.content_id == task.id).one()
    assert attempt.is_correct is False


def test_submit_multiple_choice_correct(client, user, db, subject):
    task = _make_published_task(
        db, subject,
        title="MC", answer_type="multiple_choice",
        options=["3", "4", "5"], correct_answer="1",
    )
    from app.auth import create_access_token

    token = create_access_token({"sub": user.email})
    response = client.post(
        "/gamification/submit-answer",
        headers={"Authorization": f"Bearer {token}"},
        json={"task_id": task.id, "answer": "1"},
    )

    assert response.status_code == 200
    assert response.json()["isCorrect"] is True


def test_cannot_submit_to_unpublished_task(client, user, db, subject):
    task = _make_published_task(db, subject, status="draft")
    from app.auth import create_access_token

    token = create_access_token({"sub": user.email})
    response = client.post(
        "/gamification/submit-answer",
        headers={"Authorization": f"Bearer {token}"},
        json={"task_id": task.id, "answer": "2x"},
    )

    assert response.status_code == 409


def test_submit_answer_requires_authentication(client, db, subject):
    task = _make_published_task(db, subject)

    response = client.post(
        "/gamification/submit-answer",
        json={"task_id": task.id, "answer": "2x"},
    )

    assert response.status_code == 401
