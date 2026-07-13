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
from app.models import Admin, Attempt, MasteryState, User, Task, TaskGroup, MapLocation, AdventureMap, UserProgress, Achievement
from app.auth import get_admin_current_user, get_current_user, get_token_from_request, require_role
from app.services import mastery
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