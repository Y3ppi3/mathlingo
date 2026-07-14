from tests.conftest import authorization_header


def _create_skill(client, content_manager_admin, subject, code="derivative-basics"):
    return client.post(
        "/admin/skills/",
        headers=authorization_header(content_manager_admin),
        json={"name": "Derivative basics", "code": code, "subject_id": subject.id},
    ).json()


def _create_draft_task(client, content_manager_admin, subject, skill=None):
    payload = {"title": "Find the derivative", "subject": subject.code}
    if skill:
        payload["skill_id"] = skill["id"]
    response = client.post(
        "/admin/tasks",
        headers=authorization_header(content_manager_admin),
        json=payload,
    )
    assert response.status_code == 200, response.text
    return response.json()


def test_new_task_starts_as_draft_with_defaults(client, content_manager_admin, subject):
    task = _create_draft_task(client, content_manager_admin, subject)

    assert task["status"] == "draft"
    assert task["version"] == 1
    assert task["source"] == "manual"
    assert task["level"] == "standard"


def test_teacher_cannot_create_task(client, teacher_admin, subject):
    response = client.post(
        "/admin/tasks",
        headers=authorization_header(teacher_admin),
        json={"title": "Find the derivative", "subject": subject.code},
    )

    assert response.status_code == 403


def test_task_with_skill_from_other_subject_is_rejected(client, content_manager_admin, subject, db):
    from app.models import Subject as SubjectModel

    other_subject = SubjectModel(name="Integrals", code="integrals")
    db.add(other_subject)
    db.commit()
    db.refresh(other_subject)

    foreign_skill = _create_skill(client, content_manager_admin, other_subject, code="integral-basics")

    response = client.post(
        "/admin/tasks",
        headers=authorization_header(content_manager_admin),
        json={"title": "Find the derivative", "subject": subject.code, "skill_id": foreign_skill["id"]},
    )

    assert response.status_code == 400


def test_full_lifecycle_happy_path(client, content_manager_admin, teacher_admin, subject, db):
    task = _create_draft_task(client, content_manager_admin, subject)
    task_id = task["id"]
    cm_headers = authorization_header(content_manager_admin)
    teacher_headers = authorization_header(teacher_admin)

    submitted = client.post(f"/admin/tasks/{task_id}/submit-review", headers=cm_headers)
    assert submitted.status_code == 200
    assert submitted.json()["status"] == "in_review"

    approved = client.post(f"/admin/tasks/{task_id}/approve", headers=teacher_headers)
    assert approved.status_code == 200
    assert approved.json()["status"] == "approved"
    assert approved.json()["approved_by_admin_id"] == teacher_admin.id

    published = client.post(f"/admin/tasks/{task_id}/publish", headers=cm_headers)
    assert published.status_code == 200
    assert published.json()["status"] == "published"
    assert published.json()["published_at"] is not None

    archived = client.post(f"/admin/tasks/{task_id}/archive", headers=cm_headers)
    assert archived.status_code == 200
    assert archived.json()["status"] == "archived"
    assert archived.json()["archived_at"] is not None

    from app.models import ContentStatusHistory

    history = (
        db.query(ContentStatusHistory)
        .filter(ContentStatusHistory.task_id == task_id)
        .order_by(ContentStatusHistory.id)
        .all()
    )
    assert [h.to_status for h in history] == ["in_review", "approved", "published", "archived"]
    assert history[1].actor_admin_id == teacher_admin.id


def test_request_changes_loops_back_to_review(client, content_manager_admin, teacher_admin, subject):
    task = _create_draft_task(client, content_manager_admin, subject)
    task_id = task["id"]
    cm_headers = authorization_header(content_manager_admin)
    teacher_headers = authorization_header(teacher_admin)

    client.post(f"/admin/tasks/{task_id}/submit-review", headers=cm_headers)

    changes = client.post(
        f"/admin/tasks/{task_id}/request-changes",
        headers=teacher_headers,
        json={"comment": "Опечатка в условии"},
    )
    assert changes.status_code == 200
    assert changes.json()["status"] == "needs_revision"

    # После needs_revision контент снова редактируемый
    edited = client.put(
        f"/admin/tasks/{task_id}",
        headers=cm_headers,
        json={"title": "Find the derivative (fixed)"},
    )
    assert edited.status_code == 200

    resubmitted = client.post(f"/admin/tasks/{task_id}/submit-review", headers=cm_headers)
    assert resubmitted.status_code == 200
    assert resubmitted.json()["status"] == "in_review"


def test_content_manager_cannot_approve_own_content(client, content_manager_admin, subject):
    task = _create_draft_task(client, content_manager_admin, subject)
    headers = authorization_header(content_manager_admin)
    client.post(f"/admin/tasks/{task['id']}/submit-review", headers=headers)

    response = client.post(f"/admin/tasks/{task['id']}/approve", headers=headers)

    assert response.status_code == 403


def test_teacher_cannot_submit_for_review(client, content_manager_admin, teacher_admin, subject):
    task = _create_draft_task(client, content_manager_admin, subject)

    response = client.post(
        f"/admin/tasks/{task['id']}/submit-review",
        headers=authorization_header(teacher_admin),
    )

    assert response.status_code == 403


def test_cannot_approve_a_draft_directly(client, teacher_admin, content_manager_admin, subject):
    task = _create_draft_task(client, content_manager_admin, subject)

    response = client.post(
        f"/admin/tasks/{task['id']}/approve",
        headers=authorization_header(teacher_admin),
    )

    assert response.status_code == 409


def test_cannot_edit_task_while_in_review(client, content_manager_admin, subject):
    task = _create_draft_task(client, content_manager_admin, subject)
    headers = authorization_header(content_manager_admin)
    client.post(f"/admin/tasks/{task['id']}/submit-review", headers=headers)

    response = client.put(
        f"/admin/tasks/{task['id']}",
        headers=headers,
        json={"title": "Sneaky edit"},
    )

    assert response.status_code == 409


def test_only_superadmin_can_hard_delete_task(client, admin, content_manager_admin, subject):
    task = _create_draft_task(client, content_manager_admin, subject)

    denied = client.delete(
        f"/admin/tasks/{task['id']}", headers=authorization_header(content_manager_admin)
    )
    assert denied.status_code == 403

    allowed = client.delete(f"/admin/tasks/{task['id']}", headers=authorization_header(admin))
    assert allowed.status_code == 204


# R4: DELETE /admin/tasks/{id} падал 500 (FK violation) для любого задания,
# прошедшего хотя бы один переход статуса — content_status_history/
# content_flags ссылались на tasks.id без ON DELETE (см. миграцию
# d3ffe0419916_task_fk_ondelete_cascade). Черновик из теста выше никогда
# не создавал ContentStatusHistory, поэтому не ловил баг.
def test_hard_delete_cascades_status_history_and_flags(client, admin, content_manager_admin, teacher_admin, subject, db):
    from app.models import AIGenerationItem, AIGenerationOrder, ContentFlag, ContentStatusHistory, PromptTemplate, Skill

    task = _create_draft_task(client, content_manager_admin, subject)
    task_id = task["id"]

    for action in ("submit-review", "approve", "publish"):
        actor = teacher_admin if action == "approve" else content_manager_admin
        r = client.post(f"/admin/tasks/{task_id}/{action}", headers=authorization_header(actor))
        assert r.status_code == 200, r.text

    flag = client.post(
        f"/admin/tasks/{task_id}/flags",
        headers=authorization_header(teacher_admin),
        json={"comment": "выглядит подозрительно"},
    )
    assert flag.status_code == 200, flag.text

    skill = Skill(subject_id=subject.id, name="AI order skill", code="ai-order-skill")
    db.add(skill)
    db.commit()
    db.refresh(skill)

    template = PromptTemplate(name="t", version=1, template_text="x", task_type="single_answer")
    db.add(template)
    db.commit()
    db.refresh(template)
    order = AIGenerationOrder(
        subject_id=subject.id, skill_id=skill.id, task_type="single_answer", count=1,
        prompt_template_id=template.id, status="completed",
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    ai_item = AIGenerationItem(order_id=order.id, index_in_order=0, status="ready", task_id=task_id)
    db.add(ai_item)
    db.commit()
    db.refresh(ai_item)

    assert db.query(ContentStatusHistory).filter(ContentStatusHistory.task_id == task_id).count() == 3
    assert db.query(ContentFlag).filter(ContentFlag.task_id == task_id).count() == 1

    response = client.delete(f"/admin/tasks/{task_id}", headers=authorization_header(admin))
    assert response.status_code == 204, response.text

    # CASCADE — история и жалобы удаляются вместе с заданием.
    assert db.query(ContentStatusHistory).filter(ContentStatusHistory.task_id == task_id).count() == 0
    assert db.query(ContentFlag).filter(ContentFlag.task_id == task_id).count() == 0

    # SET NULL — запись AI-генерации переживает удаление задания.
    db.refresh(ai_item)
    assert ai_item.task_id is None
