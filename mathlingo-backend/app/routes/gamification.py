# app/routes/gamification.py
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
import json
from typing import List, Optional, Union
from datetime import datetime
import jwt
import os
from dotenv import load_dotenv

from app.database import get_db
from app.models import Admin, Attempt, Diagnostic, GameScenario, MasteryState, User, Task, TaskGroup, MapLocation, AdventureMap, UserProgress, Achievement
from app.auth import get_admin_current_user, get_current_user, get_token_from_request, require_role
from app.services import content_quality, game_attempts, mastery
from app.schemas import (
    AdminCreate,
    AdminResponse,
    AdminLogin,
    AdventureMapCreate,
    AdventureMapResponse,
    LocationCreate,
    LocationResponse,
    TaskGroupCreate,
    TaskGroupResponse,
    UserProgressResponse,
    AchievementResponse,
    TaskSubmissionRequest,
    TaskSubmissionResponse,
    MasteryStateResponse,
    DiagnosticView,
    DiagnosticSubmitRequest,
    DiagnosticSubmitResponse,
    DiagnosticSubmitResult,
    SkillLevelResponse,
    LevelOverrideRequest,
    LevelOverrideResponse,
    ActiveGameScenarioResponse,
    GameAttemptSubmissionRequest,
    GameAttemptSubmissionResponse,
)

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256"

router = APIRouter(tags=["gamification"])


# Функция для получения пользователя или администратора по токену
def get_any_user(request: Request, db: Session = Depends(get_db)):
    """
    Tries to get a user or admin by token.
    First checks for admin token, then user token.
    """
    token = get_token_from_request(request)

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token is missing"
        )

    try:
        # Print the token for debugging (only first 20 chars for security)
        token_preview = token[:20] + "..." if len(token) > 20 else token
        print(f"🔍 Verifying token: {token_preview}", flush=True)

        # Print SECRET_KEY for debugging (only first few chars)
        key_preview = SECRET_KEY[:5] + "..." if len(SECRET_KEY) > 5 else SECRET_KEY
        print(f"🔑 Using SECRET_KEY: {key_preview}", flush=True)

        # Decode with more lenient options for debugging
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM],
            options={"verify_signature": True}  # Set to False temporarily to debug if needed
        )

        user_email = payload.get("sub")
        user_role = payload.get("role")

        print(f"📋 Token payload: email={user_email}, role={user_role}", flush=True)

        # First try to authenticate as admin if role is specified
        if user_role == "admin":
            admin = db.query(Admin).filter(Admin.email == user_email).first()
            if admin:
                print(f"✅ Authorized as admin: {admin.email} (ID {admin.id})", flush=True)
                return admin

        # If not admin or admin not found, try as regular user
        user = db.query(User).filter(User.email == user_email).first()
        if user:
            print(f"✅ Authorized as user: {user.email} (ID {user.id})", flush=True)
            return user

        # If no user found with the token's email
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    except (jwt.exceptions.InvalidSignatureError, jwt.exceptions.PyJWTError) as e:
        # Better error handling with specific message
        print(f"❌ Token verification failed: {str(e)}", flush=True)

        # Add more detailed diagnostics
        try:
            # Try to decode without verification just to see payload
            unverified_payload = jwt.decode(
                token,
                options={"verify_signature": False},
                algorithms=[ALGORITHM]
            )
            print(f"⚠️ Unverified payload: {unverified_payload}", flush=True)
        except Exception as inner_e:
            print(f"⚠️ Could not decode token even without verification: {str(inner_e)}", flush=True)

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid authentication token: {str(e)}"
        )


# --- Маршруты для карты приключений ---

@router.post("/maps/", response_model=AdventureMapResponse)
def create_map(
        map_data: AdventureMapCreate,
        db: Session = Depends(get_db),
        current_admin: Admin = Depends(require_role("superadmin", "content_manager"))
):
    """Создать новую карту приключений (только для администраторов)"""
    new_map = AdventureMap(
        name=map_data.name,
        description=map_data.description,
        background_image=map_data.background_image,
        subject_id=map_data.subject_id
    )
    db.add(new_map)
    db.commit()
    db.refresh(new_map)
    return new_map


@router.get("/maps/{subject_id}", response_model=List[AdventureMapResponse])
def get_maps_by_subject(
        subject_id: int,
        request: Request,
        db: Session = Depends(get_db)
):
    """Получить все карты для указанного предмета"""
    # Check for admin token in Authorization header first
    auth_header = request.headers.get("Authorization")
    admin_user = None

    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        try:
            # Verify with admin token
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            email = payload.get("sub")
            role = payload.get("role")

            if role == "admin":
                admin_user = db.query(Admin).filter(Admin.email == email).first()
        except (jwt.exceptions.InvalidSignatureError, jwt.exceptions.PyJWTError):
            # Failed admin token check, continue to cookie check
            pass

    # If admin authentication succeeded, use admin user
    if admin_user:
        print(f"✅ Admin access for maps: {admin_user.email} (ID {admin_user.id})", flush=True)
    else:
        # Try regular user authentication with cookie
        try:
            token = request.cookies.get("token")
            if not token:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authentication token missing"
                )

            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            user_email = payload.get("sub")

            user = db.query(User).filter(User.email == user_email).first()
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="User not found"
                )

            print(f"✅ User access for maps: {user.email} (ID {user.id})", flush=True)
        except (jwt.exceptions.InvalidSignatureError, jwt.exceptions.PyJWTError) as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid authentication token: {str(e)}"
            )

    # Fetch maps for the specified subject
    maps = db.query(AdventureMap).filter(AdventureMap.subject_id == subject_id).all()
    return maps


@router.get("/map/{map_id}", response_model=AdventureMapResponse)
def get_map_by_id(
        map_id: int,
        request: Request,
        db: Session = Depends(get_db)
):
    """Получить карту по её идентификатору"""
    # Пытаемся аутентифицировать как пользователя, так и администратора
    user = get_any_user(request, db)

    # Получаем карту по ID
    adventure_map = db.query(AdventureMap).filter(AdventureMap.id == map_id).first()
    if not adventure_map:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Карта не найдена")

    return adventure_map


@router.get("/maps/{map_id}/data")
def get_map_data(
        map_id: int,
        request: Request,
        db: Session = Depends(get_db)
):
    """Получить полные данные карты со всеми локациями и группами заданий"""

    # Check for admin token in Authorization header first
    auth_header = request.headers.get("Authorization")
    admin_user = None
    user = None

    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        try:
            # Verify with admin token
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            email = payload.get("sub")
            role = payload.get("role")

            if role == "admin":
                admin_user = db.query(Admin).filter(Admin.email == email).first()
                if admin_user:
                    print(f"✅ Admin access to map data: {admin_user.email} (ID {admin_user.id})", flush=True)
                    user = admin_user  # Use admin as the authenticated user
        except Exception as e:
            print(f"⚠️ Admin token verification failed: {str(e)}", flush=True)
            # Continue to cookie check if admin auth fails

    # If admin authentication failed, try regular user authentication with cookie
    if not user:
        try:
            cookie_token = request.cookies.get("token")
            if not cookie_token:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authentication token missing"
                )

            payload = jwt.decode(cookie_token, SECRET_KEY, algorithms=[ALGORITHM])
            user_email = payload.get("sub")

            user = db.query(User).filter(User.email == user_email).first()
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="User not found"
                )

            print(f"✅ User access to map data: {user.email} (ID {user.id})", flush=True)
        except (jwt.exceptions.InvalidSignatureError, jwt.exceptions.PyJWTError) as e:
            print(f"❌ Cookie token verification failed: {str(e)}", flush=True)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid authentication token: {str(e)}"
            )

    # Now that authentication is handled, proceed with the original function logic
    adventure_map = db.query(AdventureMap).filter(AdventureMap.id == map_id).first()
    if not adventure_map:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Карта не найдена")

    # Get all locations for this map
    locations = db.query(MapLocation).filter(MapLocation.adventure_map_id == map_id).all()

    # Get user progress (only if this is a regular user, not an administrator)
    user_id = getattr(user, 'id', None)
    user_progress = None

    if isinstance(user, User):
        user_progress = db.query(UserProgress).filter(UserProgress.user_id == user.id).first()

        if not user_progress:
            # Create progress record if it doesn't exist
            user_progress = UserProgress(
                user_id=user.id,
                current_level=1,
                total_points=0,
                completed_locations="[]",
                unlocked_achievements="[]"
            )
            db.add(user_progress)
            db.commit()
            db.refresh(user_progress)
    else:
        # For administrator create a fake progress object
        user_progress = UserProgress(
            user_id=0,
            current_level=1,
            total_points=0,
            completed_locations="[]",
            unlocked_achievements="[]"
        )

    # Convert JSON strings to lists
    completed_locations = json.loads(user_progress.completed_locations)
    unlocked_achievements = json.loads(user_progress.unlocked_achievements)

    # Determine unlocked locations (first is always unlocked)
    unlocked_locations = []

    for location in locations:
        # Admin sees all locations
        if isinstance(user, Admin):
            unlocked_locations.append(location.id)
        else:
            # For regular users follow unlocking rules
            if location.unlocked_by_location_id is None:
                unlocked_locations.append(location.id)
            elif location.unlocked_by_location_id in completed_locations:
                unlocked_locations.append(location.id)

    # Get task groups for each location
    location_data = []
    for location in locations:
        task_groups = db.query(TaskGroup).filter(TaskGroup.location_id == location.id).all()

        # Get tasks for each group
        task_group_data = []
        for group in task_groups:
            tasks = db.query(Task).filter(Task.task_group_id == group.id).all()
            task_ids = [task.id for task in tasks]

            task_group_data.append({
                "id": group.id,
                "name": group.name,
                "description": group.description,
                "difficulty": group.difficulty,
                "reward_points": group.reward_points,
                "tasks": task_ids
            })

        location_data.append({
            "id": location.id,
            "name": location.name,
            "description": location.description,
            "position_x": location.position_x,
            "position_y": location.position_y,
            "icon_url": location.icon_url,
            "taskGroups": task_group_data
        })

    # Build response
    response = {
        "map": {
            "id": adventure_map.id,
            "name": adventure_map.name,
            "description": adventure_map.description,
            "background_image": adventure_map.background_image,
            "subject_id": adventure_map.subject_id,
            "locations": location_data
        },
        "userProgress": {
            "level": user_progress.current_level,
            "totalPoints": user_progress.total_points,
            "completedLocations": completed_locations,
            "unlockedLocations": unlocked_locations,
            "unlockedAchievements": unlocked_achievements
        }
    }

    return response


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


@router.get("/skills/{skill_id}/mastery", response_model=MasteryStateResponse)
def get_skill_mastery(
        skill_id: int,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user),
):
    """
    Текущее mastery_state ученика по теме — только для себя (current_user),
    не по чужому user_id. Полноценный UI "почему такая рекомендация" и
    временный выбор соседнего уровня — R2 task 4, здесь только данные.
    """
    state = (
        db.query(MasteryState)
        .filter(MasteryState.user_id == current_user.id, MasteryState.skill_id == skill_id)
        .first()
    )
    if not state:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ещё нет данных по этой теме — нужна хотя бы одна попытка",
        )
    return state


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


# --- Рекомендация уровня "с причиной" + временный выбор соседнего (R2 task 4) ---

@router.get("/skills/{skill_id}/level", response_model=SkillLevelResponse)
def get_skill_level(
        skill_id: int,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user),
):
    """
    В отличие от /mastery — всегда 200, даже без единой попытки (nullable
    поля), потому что это основной эндпоинт для экрана "твой уровень",
    который должен показать осмысленное "пока нет данных", а не ошибку.
    """
    state = (
        db.query(MasteryState)
        .filter(MasteryState.user_id == current_user.id, MasteryState.skill_id == skill_id)
        .first()
    )
    override = mastery.get_active_override(db, current_user.id, skill_id)

    computed_level = state.level if state else None
    effective_level = override.chosen_level if override else computed_level

    return SkillLevelResponse(
        skill_id=skill_id,
        computed_level=computed_level,
        confidence=state.confidence if state else 0,
        sample_size=state.sample_size if state else 0,
        factors=state.factors if state else None,
        override=override,
        effective_level=effective_level,
    )


@router.post("/skills/{skill_id}/level-override", response_model=SkillLevelResponse)
def set_skill_level_override(
        skill_id: int,
        body: LevelOverrideRequest,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user),
):
    try:
        mastery.set_override(db, current_user.id, skill_id, body.chosen_level)
    except ValueError as e:
        if str(e) == "no_mastery_state":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Нужна хотя бы одна попытка или диагностика, прежде чем выбирать уровень вручную",
            )
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Можно выбрать только соседний уровень относительно рекомендованного",
        )
    return get_skill_level(skill_id, db, current_user)


@router.delete("/skills/{skill_id}/level-override", response_model=SkillLevelResponse)
def clear_skill_level_override(
        skill_id: int,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user),
):
    mastery.clear_override(db, current_user.id, skill_id)
    return get_skill_level(skill_id, db, current_user)


@router.get("/game-scenarios/active/{template_key}", response_model=ActiveGameScenarioResponse)
def get_active_game_scenario(
        template_key: str,
        mode: Optional[str] = None,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user),
):
    """
    R3 task 3/4: единственная точка, откуда игровые компоненты берут конфиг —
    DerivFall/IntegralBuilder/MathLab больше не хранят задания в коде, а
    запрашивают текущий опубликованный сценарий шаблона здесь. Если
    опубликованных сценариев несколько (после задачи 5, когда появится
    конструктор) — берём самый свежий по published_at; выбор "какой именно
    сценарий подходит ученику" (level_range/группы) — вне scope этой задачи,
    минимально жизнеспособная выборка.

    `mode` — только для mathlab: derivatives/integrals делят один
    template_key, но это разные опубликованные сценарии (см.
    MathLabConfig.mode), поэтому фильтруем по config->mode в Python, а не
    в SQL — набор опубликованных сценариев одного шаблона мал, а
    JSON-фильтрация в SQL отличалась бы между SQLite (тесты) и Postgres
    (dev/prod) без practической пользы.
    """
    if template_key not in GameScenario.TEMPLATE_KEYS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Неизвестный template_key: {template_key}")

    now = datetime.utcnow()
    scenarios = (
        db.query(GameScenario)
        .filter(
            GameScenario.template_key == template_key,
            GameScenario.status == "published",
            (GameScenario.availability_from == None) | (GameScenario.availability_from <= now),
            (GameScenario.availability_to == None) | (GameScenario.availability_to >= now),
        )
        .order_by(GameScenario.published_at.desc())
        .all()
    )
    if mode is not None:
        scenarios = [s for s in scenarios if s.config.get("mode") == mode]

    if not scenarios:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Для этого шаблона нет доступного опубликованного сценария")

    return scenarios[0]


def _is_scenario_active(scenario: GameScenario, now: datetime) -> bool:
    if scenario.status != "published":
        return False
    if scenario.availability_from is not None and scenario.availability_from > now:
        return False
    if scenario.availability_to is not None and scenario.availability_to < now:
        return False
    return True


@router.post("/game-scenarios/{scenario_id}/submit-attempt", response_model=GameAttemptSubmissionResponse)
def submit_game_attempt(
        scenario_id: int,
        body: GameAttemptSubmissionRequest,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user),
):
    """
    R3 task 6: игра пишет ОДНУ попытку на всю сессию (score/max_score), а не
    на каждый внутриигровой ответ — см. app/services/game_attempts.py.
    Дополнительно валидирует, что content_id — активный (опубликованный и в
    окне доступности) game_scenario, как того требует план (R3 §3).
    """
    scenario = db.query(GameScenario).filter(GameScenario.id == scenario_id).first()
    if not scenario:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Сценарий не найден")
    if not _is_scenario_active(scenario, datetime.utcnow()):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Сценарий недоступен для игры")

    attempt = game_attempts.record_attempt(
        db, current_user.id, scenario,
        score=body.score, max_score=body.max_score, time_spent_ms=body.time_spent_ms,
    )
    return GameAttemptSubmissionResponse(is_correct=attempt.is_correct)