"""
R2 task 2: пересчёт mastery_state по окну последних попыток на (user, skill).

Пороги ниже — начальные, тюнятся по мере накопления реальных данных (см.
docs/roadmap/product-technical-plan.md, R2 §7 — "холодный старт"). Здесь они
собраны в одном месте намеренно: любое изменение алгоритма должно быть видно
в golden-тестах (tests/test_mastery_service.py) одним диффом, а не
раскопками по всему сервисному слою.
"""
from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from app.models import Attempt, MasteryState, Task

# Последние N попыток по (user, skill) — попытки старше окна не влияют на
# текущий уровень. Игровые попытки (source="game") участвуют наравне с
# обычными на уровне ЭТОГО окна — сам факт агрегации по многим попыткам
# и есть требование "не по одной попытке", отдельного веса источника пока
# не вводим (нет реальных game-попыток до R3).
WINDOW_SIZE = 10

# При таком количестве попыток в окне уверенность считается полной (100).
# Меньше — confidence пропорционально ниже; это то самое "холодный старт
# помечается низкой уверенностью" из плана.
FULL_CONFIDENCE_SAMPLES = 10

ADVANCED_ACCURACY = 0.85
ADVANCED_TIME_RATIO = 0.7   # решает быстрее 70% от estimated_time_seconds
ADVANCED_HINTS_RATE = 0.1   # подсказками пользуется реже, чем в 10% попыток

BASIC_ACCURACY = 0.5
BASIC_TIME_RATIO = 1.3      # решает медленнее 130% от estimated_time_seconds
BASIC_HINTS_RATE = 0.5      # подсказками пользуется в половине попыток и чаще


def _determine_level(accuracy: float, avg_time_ratio: Optional[float], hints_rate: float) -> str:
    is_fast_enough = avg_time_ratio is None or avg_time_ratio <= ADVANCED_TIME_RATIO
    if accuracy >= ADVANCED_ACCURACY and hints_rate <= ADVANCED_HINTS_RATE and is_fast_enough:
        return "advanced"

    is_too_slow = avg_time_ratio is not None and avg_time_ratio >= BASIC_TIME_RATIO
    if accuracy < BASIC_ACCURACY or hints_rate >= BASIC_HINTS_RATE or is_too_slow:
        return "basic"

    return "standard"


def recompute(db: Session, user_id: int, skill_id: int) -> Optional[MasteryState]:
    """
    Пересчитывает и сохраняет mastery_state для (user_id, skill_id) по
    последним WINDOW_SIZE попыткам. Возвращает None, если попыток вообще
    нет — нечего считать, старое состояние (если было) не трогаем.
    """
    attempts = (
        db.query(Attempt)
        .filter(Attempt.user_id == user_id, Attempt.skill_id == skill_id)
        .order_by(Attempt.created_at.desc(), Attempt.id.desc())
        .limit(WINDOW_SIZE)
        .all()
    )
    if not attempts:
        return None

    sample_size = len(attempts)
    accuracy = sum(1 for a in attempts if a.is_correct) / sample_size
    hints_rate = sum(1 for a in attempts if a.hints_used > 0) / sample_size

    time_ratios = []
    for a in attempts:
        if a.time_spent_ms is None:
            continue
        task = db.query(Task).filter(Task.id == a.content_id).first()
        if task and task.estimated_time_seconds:
            time_ratios.append((a.time_spent_ms / 1000) / task.estimated_time_seconds)
    avg_time_ratio = sum(time_ratios) / len(time_ratios) if time_ratios else None

    level = _determine_level(accuracy, avg_time_ratio, hints_rate)
    confidence = round(min(1.0, sample_size / FULL_CONFIDENCE_SAMPLES) * 100)

    state = (
        db.query(MasteryState)
        .filter(MasteryState.user_id == user_id, MasteryState.skill_id == skill_id)
        .first()
    )
    if not state:
        state = MasteryState(user_id=user_id, skill_id=skill_id)
        db.add(state)

    state.level = level
    state.confidence = confidence
    state.sample_size = sample_size
    state.factors = {
        "accuracy": round(accuracy, 3),
        "avg_time_ratio": round(avg_time_ratio, 3) if avg_time_ratio is not None else None,
        "hints_rate": round(hints_rate, 3),
    }
    # attempts отсортированы desc: [0] — самая новая попытка в окне, [-1] — самая старая
    state.window_to = attempts[0].created_at
    state.window_from = attempts[-1].created_at
    state.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(state)
    return state
