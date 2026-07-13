"""
R2 task 5: AI-конвейер на мок-провайдере. Стадии тестируются напрямую
(быстро, без HTTP), оркестрация и права — через реальные эндпоинты.
"""
from app.services import ai_pipeline
from app.services.ai_provider import AIProviderClient
from tests.conftest import authorization_header


class FakeProvider(AIProviderClient):
    def __init__(self, draft=None, raise_error=False):
        self.draft = draft
        self.raise_error = raise_error

    def generate(self, prompt_text, task_type, level):
        if self.raise_error:
            raise RuntimeError("provider unavailable")
        return dict(self.draft)


# --- Стадии конвейера напрямую ---

def test_validate_schema_accepts_valid_draft():
    draft = {"title": "t", "content": "<p>c</p>", "answer_type": "single_answer", "correct_answer": "42"}
    result = ai_pipeline._validate_schema(draft)
    assert result["valid"] is True


def test_validate_schema_rejects_missing_correct_answer():
    draft = {"title": "t", "content": "<p>c</p>", "answer_type": "single_answer"}
    result = ai_pipeline._validate_schema(draft)
    assert result["valid"] is False
    assert result["errors"]


def test_sanitize_strips_disallowed_tags():
    draft = {"content": "<script>alert(1)</script><p>ok</p>", "options": None}
    result = ai_pipeline._sanitize(draft)
    assert "<script>" not in draft["content"]
    assert result["changed"] is True
    assert result["content_became_empty"] is False


def test_sanitize_flags_when_content_becomes_fully_empty():
    # bleach strip=True убирает ТЕГ, но не текст внутри него — "<script>x</script>"
    # станет просто "x", не пустой строкой. Пусто получается только у тегов
    # без текстового содержимого, напр. голый <img>.
    draft = {"content": "<img src=x onerror=alert(1)>", "options": None}
    result = ai_pipeline._sanitize(draft)
    assert result["content_became_empty"] is True


def test_sanitize_cleans_options_too():
    draft = {"content": "<p>q</p>", "options": ["<b>3</b>", "<img src=x onerror=alert(1)>4"]}
    ai_pipeline._sanitize(draft)
    assert "onerror" not in draft["options"][1]


def test_check_deterministic_answer_multiple_choice_valid():
    draft = {"answer_type": "multiple_choice", "options": ["3", "4", "5"], "correct_answer": "1"}
    result = ai_pipeline._check_deterministic_answer(draft)
    assert result["passed"] is True


def test_check_deterministic_answer_multiple_choice_out_of_range():
    draft = {"answer_type": "multiple_choice", "options": ["3", "4"], "correct_answer": "5"}
    result = ai_pipeline._check_deterministic_answer(draft)
    assert result["passed"] is False


def test_check_deterministic_answer_single_answer_empty_rejected():
    draft = {"answer_type": "single_answer", "correct_answer": "   "}
    result = ai_pipeline._check_deterministic_answer(draft)
    assert result["passed"] is False


def test_ai_critic_flags_short_content():
    assert ai_pipeline._ai_critic({"content": "hi"})["verdict"] == "low_quality"
    assert ai_pipeline._ai_critic({"content": "a fairly long question body"})["verdict"] == "ok"


# --- process_item / process_order с фейковым провайдером ---

def _make_order(db, subject, skill, count=1, task_type="single_answer"):
    from app.models import AIGenerationOrder, PromptTemplate

    template = PromptTemplate(name="t", template_text="...", task_type=task_type)
    db.add(template)
    db.commit()
    db.refresh(template)

    order = AIGenerationOrder(
        subject_id=subject.id, skill_id=skill.id, level="standard",
        task_type=task_type, count=count, prompt_template_id=template.id,
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    return order


def _make_skill_row(db, subject):
    from app.models import Skill

    skill = Skill(subject_id=subject.id, name="s", code="ai-skill")
    db.add(skill)
    db.commit()
    db.refresh(skill)
    return skill


def test_process_order_creates_draft_task_for_valid_item(client, db, subject):
    skill = _make_skill_row(db, subject)
    order = _make_order(db, subject, skill)
    provider = FakeProvider(draft={
        "title": "t", "content": "<p>2+2</p>", "answer_type": "single_answer",
        "options": None, "correct_answer": "4",
    })

    ai_pipeline.process_order(db, order, provider)

    from app.models import AIGenerationItem, Task

    item = db.query(AIGenerationItem).filter(AIGenerationItem.order_id == order.id).one()
    assert item.status == "ready"
    assert item.task_id is not None

    task = db.query(Task).filter(Task.id == item.task_id).one()
    assert task.status == "draft"
    assert task.source == "ai"
    assert task.skill_id == skill.id


def test_process_item_failed_generation_when_provider_raises(client, db, subject):
    skill = _make_skill_row(db, subject)
    order = _make_order(db, subject, skill)
    provider = FakeProvider(raise_error=True)

    ai_pipeline.process_order(db, order, provider)

    from app.models import AIGenerationItem

    item = db.query(AIGenerationItem).filter(AIGenerationItem.order_id == order.id).one()
    assert item.status == "failed_generation"
    assert item.task_id is None


def test_process_item_failed_validation_when_schema_invalid(client, db, subject):
    skill = _make_skill_row(db, subject)
    order = _make_order(db, subject, skill)
    provider = FakeProvider(draft={"title": "t"})  # без content/answer_type/correct_answer

    ai_pipeline.process_order(db, order, provider)

    from app.models import AIGenerationItem

    item = db.query(AIGenerationItem).filter(AIGenerationItem.order_id == order.id).one()
    assert item.status == "failed_validation"
    assert item.task_id is None


def test_process_item_failed_answer_check_for_bad_mc_index(client, db, subject):
    skill = _make_skill_row(db, subject)
    order = _make_order(db, subject, skill, task_type="multiple_choice")
    provider = FakeProvider(draft={
        "title": "t", "content": "<p>q</p>", "answer_type": "multiple_choice",
        "options": ["3", "4"], "correct_answer": "9",
    })

    ai_pipeline.process_order(db, order, provider)

    from app.models import AIGenerationItem

    item = db.query(AIGenerationItem).filter(AIGenerationItem.order_id == order.id).one()
    assert item.status == "failed_answer_check"


def test_process_order_completes_even_with_failed_items(client, db, subject):
    skill = _make_skill_row(db, subject)
    order = _make_order(db, subject, skill)
    provider = FakeProvider(raise_error=True)

    result = ai_pipeline.process_order(db, order, provider)

    assert result.status == "completed"


# --- HTTP / RBAC ---

def _make_template_via_db(db, task_type="single_answer"):
    from app.models import PromptTemplate

    t = PromptTemplate(name="t", template_text="...", task_type=task_type)
    db.add(t)
    db.commit()
    db.refresh(t)
    return t


def test_teacher_cannot_create_ai_order(client, teacher_admin, db, subject):
    skill = _make_skill_row(db, subject)
    template = _make_template_via_db(db)

    response = client.post(
        "/admin/ai/orders",
        headers=authorization_header(teacher_admin),
        json={
            "subject_id": subject.id, "skill_id": skill.id, "task_type": "single_answer",
            "count": 1, "prompt_template_id": template.id,
        },
    )
    assert response.status_code == 403


def test_content_manager_can_create_ai_order(client, content_manager_admin, db, subject):
    skill = _make_skill_row(db, subject)
    template = _make_template_via_db(db)

    response = client.post(
        "/admin/ai/orders",
        headers=authorization_header(content_manager_admin),
        json={
            "subject_id": subject.id, "skill_id": skill.id, "task_type": "single_answer",
            "count": 3, "prompt_template_id": template.id,
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "completed"
    assert len(body["items"]) == 3
    # мок-провайдер всегда генерирует валидные single_answer -> все ready
    assert all(item["status"] == "ready" for item in body["items"])


def test_ai_order_rejects_count_out_of_range(client, content_manager_admin, db, subject):
    skill = _make_skill_row(db, subject)
    template = _make_template_via_db(db)

    response = client.post(
        "/admin/ai/orders",
        headers=authorization_header(content_manager_admin),
        json={
            "subject_id": subject.id, "skill_id": skill.id, "task_type": "single_answer",
            "count": 999, "prompt_template_id": template.id,
        },
    )
    assert response.status_code == 400


def test_ai_order_rejects_skill_from_other_subject(client, content_manager_admin, db, subject):
    from app.models import Subject as SubjectModel

    other_subject = SubjectModel(name="Other", code="other-subj")
    db.add(other_subject)
    db.commit()
    db.refresh(other_subject)
    skill = _make_skill_row(db, other_subject)
    template = _make_template_via_db(db)

    response = client.post(
        "/admin/ai/orders",
        headers=authorization_header(content_manager_admin),
        json={
            "subject_id": subject.id, "skill_id": skill.id, "task_type": "single_answer",
            "count": 1, "prompt_template_id": template.id,
        },
    )
    assert response.status_code == 400


def test_ai_generated_task_appears_in_regular_task_list_as_draft(client, content_manager_admin, db, subject):
    skill = _make_skill_row(db, subject)
    template = _make_template_via_db(db)
    headers = authorization_header(content_manager_admin)

    client.post(
        "/admin/ai/orders", headers=headers,
        json={
            "subject_id": subject.id, "skill_id": skill.id, "task_type": "single_answer",
            "count": 1, "prompt_template_id": template.id,
        },
    )

    tasks = client.get("/admin/tasks", headers=headers, params={"skill_id": skill.id}).json()
    assert len(tasks) == 1
    assert tasks[0]["source"] == "ai"
    assert tasks[0]["status"] == "draft"


def test_get_ai_order_detail_includes_items(client, content_manager_admin, db, subject):
    skill = _make_skill_row(db, subject)
    template = _make_template_via_db(db)
    headers = authorization_header(content_manager_admin)

    created = client.post(
        "/admin/ai/orders", headers=headers,
        json={
            "subject_id": subject.id, "skill_id": skill.id, "task_type": "single_answer",
            "count": 2, "prompt_template_id": template.id,
        },
    ).json()

    response = client.get(f"/admin/ai/orders/{created['id']}", headers=headers)
    assert response.status_code == 200
    assert len(response.json()["items"]) == 2


def test_list_ai_orders_filtered_by_skill(client, content_manager_admin, db, subject):
    skill_a = _make_skill_row(db, subject)
    from app.models import Skill

    skill_b = Skill(subject_id=subject.id, name="b", code="ai-skill-b")
    db.add(skill_b)
    db.commit()
    db.refresh(skill_b)
    template = _make_template_via_db(db)
    headers = authorization_header(content_manager_admin)

    client.post("/admin/ai/orders", headers=headers, json={
        "subject_id": subject.id, "skill_id": skill_a.id, "task_type": "single_answer",
        "count": 1, "prompt_template_id": template.id,
    })
    client.post("/admin/ai/orders", headers=headers, json={
        "subject_id": subject.id, "skill_id": skill_b.id, "task_type": "single_answer",
        "count": 1, "prompt_template_id": template.id,
    })

    response = client.get("/admin/ai/orders", headers=headers, params={"skill_id": skill_a.id})
    assert len(response.json()) == 1


# --- Квоты (R2 task 6) ---

def test_own_ai_order_creation_consumes_quota(client, content_manager_admin, db, subject):
    from app.auth import create_access_token
    from app.models import Admin

    skill = _make_skill_row(db, subject)
    template = _make_template_via_db(db)
    headers = authorization_header(content_manager_admin)

    client.post("/admin/ai/orders", headers=headers, json={
        "subject_id": subject.id, "skill_id": skill.id, "task_type": "single_answer",
        "count": 4, "prompt_template_id": template.id,
    })

    quota = client.get("/admin/ai/quota", headers=headers).json()
    assert quota["used"] == 4
    assert quota["admin_id"] == content_manager_admin.id


def test_ai_order_rejected_when_quota_exceeded(client, admin, content_manager_admin, db, subject):
    skill = _make_skill_row(db, subject)
    template = _make_template_via_db(db)
    headers = authorization_header(content_manager_admin)

    client.put(
        f"/admin/ai/quota/{content_manager_admin.id}",
        headers=authorization_header(admin),
        json={"monthly_limit": 3},
    )

    response = client.post("/admin/ai/orders", headers=headers, json={
        "subject_id": subject.id, "skill_id": skill.id, "task_type": "single_answer",
        "count": 5, "prompt_template_id": template.id,
    })
    assert response.status_code == 429

    # Отказ ничего не списал
    quota = client.get("/admin/ai/quota", headers=headers).json()
    assert quota["used"] == 0


def test_content_manager_cannot_set_others_quota(client, content_manager_admin, db):
    response = client.put(
        f"/admin/ai/quota/{content_manager_admin.id}",
        headers=authorization_header(content_manager_admin),
        json={"monthly_limit": 999},
    )
    assert response.status_code == 403


def test_superadmin_can_list_all_quotas(client, admin, content_manager_admin, db, subject):
    skill = _make_skill_row(db, subject)
    template = _make_template_via_db(db)
    client.post("/admin/ai/orders", headers=authorization_header(content_manager_admin), json={
        "subject_id": subject.id, "skill_id": skill.id, "task_type": "single_answer",
        "count": 2, "prompt_template_id": template.id,
    })

    response = client.get("/admin/ai/quotas", headers=authorization_header(admin))
    assert response.status_code == 200
    assert any(q["admin_id"] == content_manager_admin.id and q["used"] == 2 for q in response.json())


def test_content_manager_cannot_list_all_quotas(client, content_manager_admin):
    response = client.get("/admin/ai/quotas", headers=authorization_header(content_manager_admin))
    assert response.status_code == 403
