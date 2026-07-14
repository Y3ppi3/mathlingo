"""
R3 task 6: запись игровых попыток в общую таблицу attempts + интеграция с
mastery_service. Игровой компонент (DerivFall/IntegralBuilder/MathLab)
отдаёт только итог сессии — score/max_score, а не каждый отдельный ответ
внутри игры (см. GamePage.tsx onComplete у всех трёх шаблонов) — поэтому
одна сыгранная сессия = ОДНА запись в attempts, а не по записи на каждую
внутриигровую задачу. Это и есть "не 1:1 с обычной попыткой" из плана
(docs/roadmap/product-technical-plan.md, R2 §2, R3 §3): обычный Attempt —
это один решённый Task, игровой Attempt — это агрегат целой сессии.
"""
from typing import Optional

from sqlalchemy.orm import Session

from app.models import Attempt, GameScenario, UserProgress
from app.services import mastery

# Порог "сессия засчитана как успешная" — начальный, как и пороги в
# mastery.py (см. комментарий там же про то, почему они собраны в одном
# месте). 50%: заработать хотя бы половину максимума за сессию.
GAME_SESSION_PASS_THRESHOLD = 0.5

# R4: раньше игровые попытки не начисляли очки вообще (только submit_answer
# для обычных заданий, см. app/routes/gamification_tasks.py) — очки за игры
# нигде не суммировались. База сопоставима по порядку с reward_points
# заданий (обычно 5-10), но игровая сессия длиннее одного задания.
GAME_SESSION_REWARD_POINTS = 20


def record_attempt(
        db: Session,
        user_id: int,
        scenario: GameScenario,
        score: int,
        max_score: int,
        time_spent_ms: Optional[int] = None,
) -> Attempt:
    """
    Пишет одну запись в attempts (content_type=game, source=game) и, если у
    сценария указана тема (skill_id — nullable, см. app/models.py
    GameScenario), синхронно пересчитывает mastery_state по той же теме —
    тем же принципом, что submit_answer в app/routes/gamification.py.
    """
    max_score = max(0, max_score)
    score = max(0, min(score, max_score))
    is_correct = max_score > 0 and (score / max_score) >= GAME_SESSION_PASS_THRESHOLD

    attempt = Attempt(
        user_id=user_id,
        content_type="game",
        content_id=scenario.id,
        skill_id=scenario.skill_id,
        is_correct=is_correct,
        time_spent_ms=time_spent_ms,
        hints_used=0,
        source="game",
    )
    db.add(attempt)

    if is_correct:
        points_earned = round(GAME_SESSION_REWARD_POINTS * (score / max_score)) if max_score else 0
        # Та же ленивая инициализация, что в submit_answer — UserProgress
        # мог не существовать, если ученик ни разу не открывал карту.
        progress = db.query(UserProgress).filter(UserProgress.user_id == user_id).first()
        if not progress:
            progress = UserProgress(
                user_id=user_id,
                current_level=1,
                total_points=0,
                completed_locations="[]",
                unlocked_achievements="[]",
            )
            db.add(progress)
        progress.total_points += points_earned

    db.commit()
    db.refresh(attempt)

    if scenario.skill_id is not None:
        mastery.recompute(db, user_id, scenario.skill_id)

    return attempt
