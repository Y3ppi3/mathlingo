"""
R2 task 5: конвейер обработки одного AI-заказа. Каждая стадия пишет свой
результат в отдельное поле AIGenerationItem (не одно булево
"прошло/не прошло") — это и есть требование "хранить... результаты,
статусы проверок" из решений: ревьюер должен видеть, на чём конкретно
споткнулось задание, а не только факт отказа.

AI НИКОГДА не публикует сам: пайплайн доводит задание максимум до
status="draft" в обычной content-модели (см. app/routes/admin.py,
TASK_TRANSITIONS) — дальше draft -> in_review -> approved -> published
идёт через ТЕ ЖЕ эндпоинты и права, что и у ручного контента, отдельного
"review UI" для AI не строится.
"""
import bleach
from datetime import datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel, ValidationError
from sqlalchemy.orm import Session

from app.models import AIGenerationItem, AIGenerationOrder, Task
from app.services.ai_provider import AIProviderClient, MockAIProvider

ALLOWED_TAGS = ["p", "b", "i", "em", "strong", "sup", "sub", "br", "span"]
ALLOWED_ATTRS: Dict[str, list] = {}


class _DraftSchema(BaseModel):
    """Схема черновика — независима от TaskCreate (admin API): пайплайн не
    должен ломаться от несвязанных изменений схемы админ-эндпоинтов."""
    title: str
    content: str
    answer_type: str
    options: Optional[list] = None
    correct_answer: str


def _validate_schema(draft: Dict[str, Any]) -> Dict[str, Any]:
    try:
        _DraftSchema(**draft)
        return {"valid": True, "errors": []}
    except ValidationError as e:
        return {"valid": False, "errors": [err["msg"] for err in e.errors()]}


def _sanitize(draft: Dict[str, Any]) -> Dict[str, Any]:
    original_content = draft.get("content", "")
    clean_content = bleach.clean(original_content, tags=ALLOWED_TAGS, attributes=ALLOWED_ATTRS, strip=True)
    draft["content"] = clean_content

    changed = clean_content != original_content
    if draft.get("options"):
        clean_options = [bleach.clean(o, tags=ALLOWED_TAGS, attributes=ALLOWED_ATTRS, strip=True) for o in draft["options"]]
        changed = changed or clean_options != draft["options"]
        draft["options"] = clean_options

    return {"changed": changed, "content_became_empty": not clean_content.strip()}


def _check_deterministic_answer(draft: Dict[str, Any]) -> Dict[str, Any]:
    answer_type = draft.get("answer_type")
    correct_answer = draft.get("correct_answer")
    options = draft.get("options")

    if answer_type == "multiple_choice":
        if not options:
            return {"passed": False, "detail": "multiple_choice без options"}
        if not (correct_answer or "").isdigit() or not (0 <= int(correct_answer) < len(options)):
            return {"passed": False, "detail": "correct_answer не индекс в пределах options"}
        return {"passed": True, "detail": None}

    if not (correct_answer or "").strip():
        return {"passed": False, "detail": "correct_answer пуст"}
    return {"passed": True, "detail": None}


def _ai_critic(draft: Dict[str, Any]) -> Dict[str, Any]:
    """
    Заглушка (R2 task 5 — "критик как дополнительный сигнал", не блокирует
    попадание в draft, только сигнал для ревьюера). Реальная модель-критик —
    после закрытия decision gate по провайдеру.
    """
    content = draft.get("content", "")
    if len(content.strip()) < 10:
        return {"verdict": "low_quality", "note": "Слишком короткое условие"}
    return {"verdict": "ok", "note": None}


def process_item(
    db: Session,
    order: AIGenerationOrder,
    item: AIGenerationItem,
    provider: AIProviderClient,
) -> None:
    prompt_text = order.prompt_template.template_text if order.prompt_template else ""

    try:
        draft = provider.generate(prompt_text, order.task_type, order.level)
    except Exception as e:
        item.status = "failed_generation"
        item.failure_reason = str(e)
        db.commit()
        return

    item.draft_json = draft

    validation_result = _validate_schema(draft)
    item.validation_result = validation_result
    if not validation_result["valid"]:
        item.status = "failed_validation"
        item.failure_reason = "; ".join(validation_result["errors"])
        db.commit()
        return

    sanitization_result = _sanitize(draft)
    item.sanitization_result = sanitization_result
    item.draft_json = draft  # sanitize() мутирует draft на месте
    if sanitization_result["content_became_empty"]:
        item.status = "failed_validation"
        item.failure_reason = "После санитизации условие оказалось пустым"
        db.commit()
        return

    answer_check = _check_deterministic_answer(draft)
    item.deterministic_check_result = answer_check
    if not answer_check["passed"]:
        item.status = "failed_answer_check"
        item.failure_reason = answer_check["detail"]
        db.commit()
        return

    item.ai_critic_result = _ai_critic(draft)

    task = Task(
        title=draft["title"],
        content=draft["content"],
        answer_type=draft["answer_type"],
        options=draft.get("options"),
        correct_answer=draft["correct_answer"],
        subject=order.subject.code if order.subject else "",
        subject_id=order.subject_id,
        skill_id=order.skill_id,
        level=order.level,
        status="draft",
        version=1,
        source="ai",
        created_by_admin_id=order.requested_by_admin_id,
    )
    db.add(task)
    db.flush()  # получить task.id до записи в item

    item.task_id = task.id
    item.status = "ready"
    db.commit()


def process_order(db: Session, order: AIGenerationOrder, provider: Optional[AIProviderClient] = None) -> AIGenerationOrder:
    """
    Синхронная обработка всего заказа — в проекте нет очереди фоновых задач,
    при подключении реального провайдера и больших count это надо будет
    вынести в фон (см. docstring AIGenerationOrder в app/models.py).
    """
    provider = provider or MockAIProvider()
    order.status = "processing"
    db.commit()

    for i in range(order.count):
        item = AIGenerationItem(order_id=order.id, index_in_order=i, status="pending")
        db.add(item)
        db.commit()
        db.refresh(item)
        process_item(db, order, item, provider)

    order.status = "completed"
    order.created_at = order.created_at or datetime.utcnow()
    db.commit()
    db.refresh(order)
    return order
