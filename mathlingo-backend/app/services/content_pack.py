"""
Портируемые контент-паки банка ЕГЭ/ОГЭ — гибрид-модель хранения: рантайм в
Postgres (быстрая выдача с пагинацией/кэшем), а перенос на другой компьютер —
одним файлом-паком. Формат: NDJSON (по объекту на строку), первая строка —
манифест ({"_pack": {...}}), дальше задания. NDJSON выбран под большие объёмы:
пишется/читается потоково, легко просматривается и диффается, склеивается
конкатенацией. Импорт идемпотентен по external_id (upsert), поэтому один и тот
же пак можно накатывать повторно без дублей.
"""
import json
from datetime import datetime
from typing import Iterable, Optional

from sqlalchemy.orm import Session

from app.models import ExamTask

PACK_FORMAT = "mathlingo-exam-pack"
PACK_VERSION = 1

# Поля задания, которые кладём в пак (id/created_at не переносим — они локальные).
_FIELDS = (
    "exam", "track", "task_number", "topic", "difficulty",
    "statement", "answer_type", "answer", "choices", "solution",
    "source", "external_id",
)


def _task_to_dict(task: ExamTask) -> dict:
    return {f: getattr(task, f) for f in _FIELDS}


def export_pack(
        db: Session,
        exam: Optional[str] = None,
        track: Optional[str] = None,
        source: Optional[str] = None,
) -> str:
    """Сериализует отфильтрованный срез банка в NDJSON-пак (строка)."""
    query = db.query(ExamTask)
    if exam is not None:
        query = query.filter(ExamTask.exam == exam)
    if track is not None:
        query = query.filter(ExamTask.track == track)
    if source is not None:
        query = query.filter(ExamTask.source == source)
    tasks = query.order_by(ExamTask.id).all()

    manifest = {"_pack": {
        "format": PACK_FORMAT,
        "version": PACK_VERSION,
        "count": len(tasks),
        "exported_at": datetime.utcnow().isoformat(),
        "filters": {"exam": exam, "track": track, "source": source},
    }}
    lines = [json.dumps(manifest, ensure_ascii=False)]
    lines += [json.dumps(_task_to_dict(t), ensure_ascii=False) for t in tasks]
    return "\n".join(lines) + "\n"


def _iter_rows(text: str) -> Iterable[dict]:
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            yield json.loads(line)
        except json.JSONDecodeError:
            yield {"_bad": True}


def import_pack(db: Session, text: str) -> dict:
    """
    Импортирует NDJSON-пак. Манифест-строку пропускаем. Задания с external_id
    апсертим (обновляем существующее), без external_id — вставляем как новые.
    Битые строки считаем в skipped, а не роняем весь импорт.
    """
    imported = updated = skipped = 0
    for row in _iter_rows(text):
        if not isinstance(row, dict) or row.get("_pack") is not None:
            continue  # манифест — не задание
        if row.get("_bad") or not row.get("statement") or not row.get("exam"):
            skipped += 1
            continue

        payload = {f: row.get(f) for f in _FIELDS}
        payload.setdefault("difficulty", 1)
        if not payload.get("difficulty"):
            payload["difficulty"] = 1
        if not payload.get("answer_type"):
            payload["answer_type"] = "single_answer"
        if not payload.get("source"):
            payload["source"] = "import"

        ext = payload.get("external_id")
        existing = (
            db.query(ExamTask).filter(ExamTask.external_id == ext).first()
            if ext else None
        )
        if existing is not None:
            for f in _FIELDS:
                setattr(existing, f, payload[f])
            updated += 1
        else:
            db.add(ExamTask(**payload))
            imported += 1

    db.commit()
    return {"imported": imported, "updated": updated, "skipped": skipped,
            "total": imported + updated}
