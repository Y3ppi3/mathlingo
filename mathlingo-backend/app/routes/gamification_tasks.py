# app/routes/gamification_tasks.py
"""
Прохождение заданий учеником (submit-answer) и диагностика по теме
(R2 задачи 1, 3) — выделено из gamification.py при разбиении по доменам
(R4), см. docs/roadmap/product-technical-plan.md.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Attempt, Diagnostic, Task, TaskGroup, MapLocation, AdventureMap, User, UserProgress
from app.auth import get_current_user
from app.services import content_quality, mastery
from app.schemas import (
    TaskSubmissionRequest,
    TaskSubmissionResponse,
    DiagnosticView,
    DiagnosticSubmitRequest,
    DiagnosticSubmitResponse,
    DiagnosticSubmitResult,
)

router = APIRouter(prefix="/gamification", tags=["gamification"])


# --- Прохождение заданий учеником (R2 task 1 prerequisite) ---
#
# До этого POST /gamification/task-groups/{id}/data и /submit-answer не
# существовали вообще, хотя фронтенд (TaskSolver.tsx, utils/api.ts) уже их
# вызывал — весь student-facing флоу решения заданий был мёртв (404).

@router.post("/task-groups/{group_id}/data")
def get_task_group_data(
        group_id: int,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user),
):
    task_group = db.query(TaskGroup).filter(TaskGroup.id == group_id).first()
    if not task_group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Группа заданий не найдена")

    location = db.query(MapLocation).filter(MapLocation.id == task_group.location_id).first()
    adventure_map = (
        db.query(AdventureMap).filter(AdventureMap.id == location.adventure_map_id).first()
        if location else None
    )

    # Только опубликованный контент — черновики/на проверке ученику не видны.
    tasks = db.query(Task).filter(
        Task.task_group_id == group_id, Task.status == "published"
    ).all()

    return {
        "id": task_group.id,
        "name": task_group.name,
        "description": task_group.description,
        "locationName": location.name if location else "",
        "subjectId": adventure_map.subject_id if adventure_map else None,
        "tasks": [
            {
                "id": t.id,
                "title": t.title,
                # correct_answer сознательно не включён — это student-facing ответ
                "content": t.content or "",
                "options": t.options,
                "answer_type": t.answer_type,
                "difficulty_level": t.difficulty_level,
                "reward_points": t.reward_points,
                "estimated_time_seconds": t.estimated_time_seconds,
            }
            for t in tasks
        ],
        "totalPoints": sum(t.reward_points for t in tasks),
    }


def _is_answer_correct(task: Task, answer: str) -> bool:
    if task.correct_answer is None:
        return False
    if task.answer_type == "multiple_choice":
        return answer.strip() == task.correct_answer.strip()
    # single_answer: точное сравнение без учёта регистра/пробелов по краям.
    # Настоящая математическая эквивалентность ("x+1" == "1+x") — отдельный
    # deterministic-checker в AI-конвейере (R2 §2), не эта проверка.
    return answer.strip().lower() == task.correct_answer.strip().lower()


@router.post("/submit-answer", response_model=TaskSubmissionResponse)
def submit_answer(
        body: TaskSubmissionRequest,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user),
):
    task = db.query(Task).filter(Task.id == body.task_id).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Задание не найдено")
    if task.status != "published":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Задание недоступно для решения")

    is_correct = _is_answer_correct(task, body.answer)
    points = task.reward_points if is_correct else 0

    db.add(Attempt(
        user_id=current_user.id,
        content_type="task",
        content_id=task.id,
        skill_id=task.skill_id,
        is_correct=is_correct,
        time_spent_ms=body.time_spent_ms,
        hints_used=body.hints_used,
        source="manual",
    ))

    if is_correct:
        # UserProgress до этого создавался лениво только в get_map_data —
        # если ученик решает задание, ни разу не открыв карту (например,
        # прямой deep-link), строки могло не быть, и очки терялись молча.
        progress = db.query(UserProgress).filter(UserProgress.user_id == current_user.id).first()
        if not progress:
            progress = UserProgress(
                user_id=current_user.id,
                current_level=1,
                total_points=0,
                completed_locations="[]",
                unlocked_achievements="[]",
            )
            db.add(progress)
        progress.total_points += points

    db.commit()

    # Пересчёт mastery — синхронно, сразу после попытки (R2 task 2). Только
    # если у задания вообще есть тема: без skill_id некуда писать состояние.
    if task.skill_id is not None:
        mastery.recompute(db, current_user.id, task.skill_id)

    # Пост-публикационный мониторинг (R2 task 7): только для опубликованных
    # AI-заданий, no-op для ручного контента и черновиков.
    content_quality.check_for_anomaly(db, task)

    return TaskSubmissionResponse(
        isCorrect=is_correct,
        points=points,
        feedback=None if is_correct else "Попробуйте ещё раз",
    )


# --- Диагностика (R2 task 3) ---

@router.get("/skills/{skill_id}/diagnostic", response_model=DiagnosticView)
def get_skill_diagnostic(
        skill_id: int,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user),
):
    diagnostic = (
        db.query(Diagnostic)
        .filter(Diagnostic.skill_id == skill_id, Diagnostic.is_active == True)
        .order_by(Diagnostic.id.desc())
        .first()
    )
    if not diagnostic:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Диагностика по этой теме недоступна")

    tasks = db.query(Task).filter(Task.id.in_(diagnostic.task_ids)).all()
    tasks_by_id = {t.id: t for t in tasks}
    # Порядок задаётся diagnostic.task_ids, а не порядком в БД
    ordered_tasks = [tasks_by_id[tid] for tid in diagnostic.task_ids if tid in tasks_by_id]

    return DiagnosticView(
        id=diagnostic.id,
        skill_id=diagnostic.skill_id,
        tasks=[
            {
                "id": t.id,
                "title": t.title,
                "content": t.content or "",
                "options": t.options,
                "answer_type": t.answer_type,
            }
            for t in ordered_tasks
        ],
    )


@router.post("/diagnostics/{diagnostic_id}/submit", response_model=DiagnosticSubmitResponse)
def submit_diagnostic(
        diagnostic_id: int,
        body: DiagnosticSubmitRequest,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user),
):
    diagnostic = db.query(Diagnostic).filter(Diagnostic.id == diagnostic_id).first()
    if not diagnostic or not diagnostic.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Диагностика не найдена")

    valid_task_ids = set(diagnostic.task_ids)
    results = []
    correct_count = 0

    for item in body.answers:
        if item.task_id not in valid_task_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Задание {item.task_id} не входит в эту диагностику",
            )
        task = db.query(Task).filter(Task.id == item.task_id).first()
        if not task:
            continue

        is_correct = _is_answer_correct(task, item.answer)
        if is_correct:
            correct_count += 1
        results.append(DiagnosticSubmitResult(task_id=item.task_id, is_correct=is_correct))

        db.add(Attempt(
            user_id=current_user.id,
            content_type="diagnostic",
            content_id=diagnostic.id,
            skill_id=diagnostic.skill_id,
            is_correct=is_correct,
            time_spent_ms=item.time_spent_ms,
            hints_used=item.hints_used,
            source="manual",
        ))

    db.commit()

    # Один пересчёт на всю диагностику, не по каждому ответу — это и есть
    # момент "видит стартовый уровень" из решений задачи.
    mastery_state = mastery.recompute(db, current_user.id, diagnostic.skill_id)

    return DiagnosticSubmitResponse(
        results=results,
        correct_count=correct_count,
        total_count=len(results),
        mastery=mastery_state,
    )
