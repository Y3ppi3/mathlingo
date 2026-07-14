"""
Тесты финального dashboard (R3 task 7) — агрегации в app/services/dashboard.py
и ролевая видимость раздела "действия администраторов" на эндпоинте
GET /admin/dashboard/overview (teacher видит dashboard частично — без этого
раздела, см. docs/roadmap/product-technical-plan.md R3 §5).
"""
from datetime import datetime, timedelta

from app.models import (
    AIGenerationItem, AIGenerationOrder, Attempt, ContentFlag,
    GameScenario, MasteryState, PromptTemplate, Skill, Task,
)
from app.services import dashboard
from tests.conftest import authorization_header


def _make_skill(db, subject, code="skill-dash"):
    skill = Skill(subject_id=subject.id, name="Chain rule", code=code)
    db.add(skill)
    db.commit()
    db.refresh(skill)
    return skill


def _make_attempt(db, user, skill, content_type="task", content_id=1, is_correct=True, source="manual", time_spent_ms=None, when=None):
    a = Attempt(
        user_id=user.id, content_type=content_type, content_id=content_id,
        skill_id=skill.id if skill else None, is_correct=is_correct,
        time_spent_ms=time_spent_ms, source=source, created_at=when or datetime.utcnow(),
    )
    db.add(a)
    db.commit()
    return a


def _make_game_scenario(db, template_key="derivfall"):
    s = GameScenario(
        template_key=template_key,
        config={"template_key": template_key, "difficulty": 3, "time_limit": 60, "problems": []},
        status="published",
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


# --- activity_summary ---

def test_activity_summary_counts_within_window(client, db, user, subject):
    skill = _make_skill(db, subject)
    _make_attempt(db, user, skill, content_type="task")
    _make_attempt(db, user, skill, content_type="task")
    _make_attempt(db, user, skill, content_type="game", content_id=999)
    old = datetime.utcnow() - timedelta(days=90)
    _make_attempt(db, user, skill, content_type="task", when=old)

    result = dashboard.activity_summary(db, days=30)
    assert result["total_attempts"] == 3
    assert result["active_users"] == 1
    assert result["by_content_type"]["task"]["attempts"] == 2
    assert result["by_content_type"]["game"]["attempts"] == 1


def test_activity_summary_empty(client, db):
    result = dashboard.activity_summary(db)
    assert result["total_attempts"] == 0
    assert result["active_users"] == 0
    assert result["by_content_type"] == {}


# --- skill_progress_summary ---

def test_skill_progress_reflects_mastery_state(client, db, user, subject):
    skill = _make_skill(db, subject)
    db.add(MasteryState(user_id=user.id, skill_id=skill.id, level="advanced", confidence=80, sample_size=8))
    db.commit()

    result = dashboard.skill_progress_summary(db)
    assert len(result) == 1
    assert result[0]["skill_id"] == skill.id
    assert result[0]["levels"] == {"advanced": 1}
    assert result[0]["avg_confidence"] == 80.0


# --- game_completion_summary ---

def test_game_completion_summary_groups_by_template(client, db, user):
    scenario = _make_game_scenario(db, "derivfall")
    _make_attempt(db, user, None, content_type="game", content_id=scenario.id, is_correct=True, source="game", time_spent_ms=1000)
    _make_attempt(db, user, None, content_type="game", content_id=scenario.id, is_correct=False, source="game", time_spent_ms=3000)

    result = dashboard.game_completion_summary(db)
    assert len(result) == 1
    assert result[0]["template_key"] == "derivfall"
    assert result[0]["sessions"] == 2
    assert result[0]["pass_rate"] == 0.5
    assert result[0]["avg_time_spent_ms"] == 2000


def test_game_completion_summary_ignores_non_game_attempts(client, db, user, subject):
    skill = _make_skill(db, subject, code="skill-nongame")
    _make_attempt(db, user, skill, content_type="task", content_id=1)
    result = dashboard.game_completion_summary(db)
    assert result == []


# --- ai_quality_summary ---

def test_ai_quality_summary_counts(client, db):
    t = Task(title="ai-task", subject="derivatives", source="ai", status="published")
    db.add(t)
    db.commit()
    db.refresh(t)
    db.add(ContentFlag(task_id=t.id, flag_type="anomaly", status="open"))
    db.add(ContentFlag(task_id=t.id, flag_type="complaint", status="open"))
    db.add(ContentFlag(task_id=t.id, flag_type="complaint", status="resolved"))
    db.commit()

    result = dashboard.ai_quality_summary(db)
    assert result["published_ai_tasks"] == 1
    assert result["open_anomaly_flags"] == 1
    assert result["open_complaint_flags"] == 1


# --- review_queue_summary / publish_errors_summary ---

def test_review_queue_and_publish_errors(client, db, subject):
    db.add(Task(title="in-review", subject="derivatives", status="in_review"))
    db.commit()

    template = PromptTemplate(name="t", version=1, template_text="x", task_type="single_answer")
    db.add(template)
    db.commit()
    db.refresh(template)
    order = AIGenerationOrder(
        subject_id=subject.id, skill_id=1, task_type="single_answer", count=1,
        prompt_template_id=template.id, status="completed",
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    db.add(AIGenerationItem(order_id=order.id, index_in_order=0, status="pending"))
    db.add(AIGenerationItem(order_id=order.id, index_in_order=1, status="failed_validation"))
    db.commit()

    queue = dashboard.review_queue_summary(db)
    assert queue["tasks_in_review"] == 1
    assert queue["ai_items_pending"] == 1

    errors = dashboard.publish_errors_summary(db)
    assert errors == {"failed_validation": 1}


# --- admin_activity_summary ---

def test_admin_activity_summary_returns_recent_entries(client, db, content_manager_admin):
    # Мутирующий запрос под /admin пишется в audit_log мидлварью (main.py) —
    # client и db fixture делят одну in-memory SQLite (см. tests/conftest.py).
    response = client.post(
        "/admin/game-scenarios/",
        headers=authorization_header(content_manager_admin),
        json={"template_key": "derivfall", "config": {"difficulty": 3, "time_limit": 60, "problems": [
            {"id": "p1", "problem": "x", "options": ["a", "b"], "answer": "a", "difficulty": "easy"},
        ]}},
    )
    assert response.status_code == 200

    entries = dashboard.admin_activity_summary(db, limit=5)
    assert len(entries) >= 1
    assert entries[0]["actor_username"] == content_manager_admin.username
    assert entries[0]["method"] == "POST"


# --- HTTP: роль teacher не видит admin_actions ---

def test_dashboard_endpoint_requires_auth(client):
    response = client.get("/admin/dashboard/overview")
    assert response.status_code == 401


def test_dashboard_endpoint_includes_admin_actions_for_content_manager(client, content_manager_admin):
    response = client.get("/admin/dashboard/overview", headers=authorization_header(content_manager_admin))
    assert response.status_code == 200
    body = response.json()
    assert body["admin_actions"] is not None


def test_dashboard_endpoint_hides_admin_actions_for_teacher(client, teacher_admin):
    response = client.get("/admin/dashboard/overview", headers=authorization_header(teacher_admin))
    assert response.status_code == 200
    body = response.json()
    assert body["admin_actions"] is None


def test_dashboard_endpoint_shape(client, content_manager_admin):
    response = client.get("/admin/dashboard/overview", headers=authorization_header(content_manager_admin))
    assert response.status_code == 200
    body = response.json()
    for key in ("activity", "skill_progress", "game_completion", "ai_quality", "review_queue", "publish_errors"):
        assert key in body
