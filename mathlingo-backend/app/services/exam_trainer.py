"""
Ф3: тренажёр курса ЕГЭ/ОГЭ поверх банка ExamTask.

Попытки НЕ получают свою таблицу — пишем в общий Attempt с content_type="exam".
Так и задумывалась generic-ссылка content_type/content_id (см. Attempt в
models.py), и диагностика/mastery потом увидят экзаменационные попытки без
отдельного слоя. Миграция не нужна: content_type — обычная строковая колонка.

Проверка ответа — строковая, как и в Task.ANSWER_TYPES: нормализуем регистр,
пробелы и запятую-разделитель (ученик пишет «0,25», банк хранит «0.25»).
Настоящая математическая эквивалентность («1/2» ≡ «0.5») сюда сознательно не
тянется — это работа отдельного checker'а, а не сравнения строк.
"""
from typing import Optional

from sqlalchemy.orm import Session

from app.models import Attempt, ExamTask, User

# Сколько разных заданий по номеру нужно решить, чтобы считать номер закрытым.
MASTERY_SOLVED = 3


def normalize_answer(value: Optional[str]) -> str:
    """« 0,25 » → «0.25», «Да» → «да». Пробелы внутри тоже убираем: «12 34»
    и «1234» для числового ответа — одно и то же."""
    if value is None:
        return ""
    text = str(value).strip().lower().replace(",", ".")
    return "".join(text.split())


def check_answer(task: ExamTask, answer: Optional[str]) -> bool:
    return normalize_answer(answer) == normalize_answer(task.answer)


def submit_attempt(
        db: Session,
        user: User,
        task: ExamTask,
        answer: Optional[str],
        time_spent_ms: Optional[int] = None,
) -> dict:
    """Проверяет ответ, пишет попытку и возвращает разбор. Разбор отдаём в любом
    случае — в тренажёре ошибка это точка обучения, а не наказание."""
    correct = check_answer(task, answer)
    db.add(Attempt(
        user_id=user.id,
        content_type="exam",
        content_id=task.id,
        is_correct=correct,
        time_spent_ms=time_spent_ms,
        source="manual",
    ))
    db.commit()
    return {
        "correct": correct,
        "correct_answer": task.answer,
        "solution": task.solution,
    }


def _solved_task_ids(db: Session, user: User) -> set:
    rows = (
        db.query(Attempt.content_id)
        .filter(Attempt.user_id == user.id,
                Attempt.content_type == "exam",
                Attempt.is_correct.is_(True))
        .distinct()
        .all()
    )
    return {r[0] for r in rows}


def _seen_task_ids(db: Session, user: User) -> set:
    rows = (
        db.query(Attempt.content_id)
        .filter(Attempt.user_id == user.id, Attempt.content_type == "exam")
        .distinct()
        .all()
    )
    return {r[0] for r in rows}


def next_task(
        db: Session,
        user: User,
        exam: Optional[str] = None,
        track: Optional[str] = None,
        topic: Optional[str] = None,
        task_number: Optional[int] = None,
) -> Optional[ExamTask]:
    """
    Следующее задание для тренировки. Порядок предпочтения:
      1) ещё не виденное — новое всегда интереснее;
      2) виденное, но не решённое — работа над ошибками;
      3) любое из среза — если всё решено, даём повторить.
    Возвращает None, если под фильтры нет ни одного задания.
    """
    query = db.query(ExamTask)
    if exam is not None:
        query = query.filter(ExamTask.exam == exam)
    if track is not None:
        query = query.filter(ExamTask.track == track)
    if topic is not None:
        query = query.filter(ExamTask.topic == topic)
    if task_number is not None:
        query = query.filter(ExamTask.task_number == task_number)

    candidates = query.order_by(ExamTask.difficulty, ExamTask.id).all()
    if not candidates:
        return None

    seen = _seen_task_ids(db, user)
    solved = _solved_task_ids(db, user)

    for task in candidates:
        if task.id not in seen:
            return task
    for task in candidates:
        if task.id not in solved:
            return task
    return candidates[0]


def compute_progress(
        db: Session,
        user: User,
        exam: Optional[str] = None,
        track: Optional[str] = None,
) -> dict:
    """
    Прогресс по номерам заданий: сколько всего в банке, сколько решено, точность.
    Агрегируем на стороне Python — банк на пользователя небольшой, зато запрос
    портируем между Postgres и SQLite (тот же приём, что в content_quality.py).
    """
    query = db.query(ExamTask)
    if exam is not None:
        query = query.filter(ExamTask.exam == exam)
    if track is not None:
        query = query.filter(ExamTask.track == track)
    tasks = query.all()
    by_id = {t.id: t for t in tasks}

    attempts = (
        db.query(Attempt)
        .filter(Attempt.user_id == user.id, Attempt.content_type == "exam")
        .all()
    )
    attempts = [a for a in attempts if a.content_id in by_id]

    buckets: dict = {}
    for task in tasks:
        key = (task.task_number, task.topic)
        b = buckets.setdefault(key, {
            "task_number": task.task_number, "topic": task.topic,
            "total": 0, "solved_ids": set(), "attempts": 0, "correct": 0,
        })
        b["total"] += 1

    for a in attempts:
        task = by_id[a.content_id]
        b = buckets[(task.task_number, task.topic)]
        b["attempts"] += 1
        if a.is_correct:
            b["correct"] += 1
            b["solved_ids"].add(a.content_id)

    items = []
    for b in buckets.values():
        solved = len(b["solved_ids"])
        items.append({
            "task_number": b["task_number"],
            "topic": b["topic"],
            "total": b["total"],
            "solved": solved,
            "attempts": b["attempts"],
            "correct": b["correct"],
            "accuracy": round(b["correct"] / b["attempts"], 3) if b["attempts"] else None,
            "mastered": solved >= min(MASTERY_SOLVED, b["total"]),
        })
    items.sort(key=lambda i: (i["task_number"] is None, i["task_number"] or 0, i["topic"] or ""))

    total_attempts = len(attempts)
    return {
        "exam": exam,
        "track": track,
        "total_tasks": len(tasks),
        "solved_tasks": len({a.content_id for a in attempts if a.is_correct}),
        "attempts": total_attempts,
        "correct": sum(1 for a in attempts if a.is_correct),
        "accuracy": round(sum(1 for a in attempts if a.is_correct) / total_attempts, 3) if total_attempts else None,
        "mastered_numbers": sum(1 for i in items if i["mastered"]),
        "items": items,
    }
