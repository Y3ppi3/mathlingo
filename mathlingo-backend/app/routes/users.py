from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Response, Body
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel

from app.database import get_db
from app.models import User
from app.schemas import UserLogin, UserCreate
from app.auth import verify_password, hash_password, create_access_token, get_current_user

router = APIRouter()

# Обычная сессия — 1 день (как было раньше). "Запомнить меня" продлевает
# и cookie, и сам JWT до 30 дней — если продлить только cookie, запросы
# всё равно начали бы падать через 7 дней (ACCESS_TOKEN_EXPIRE_MINUTES в
# app/auth.py), а пользователь не понимал бы, почему его разлогинило.
DEFAULT_SESSION_SECONDS = 86400
REMEMBER_ME_SECONDS = 60 * 60 * 24 * 30


@router.post("/login/")
def login_user(user: UserLogin, response: Response, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == user.email).first()
    if not db_user or not verify_password(user.password, db_user.hashed_password):
        raise HTTPException(status_code=400, detail="Неверный email или пароль")

    max_age = REMEMBER_ME_SECONDS if user.remember_me else DEFAULT_SESSION_SECONDS
    access_token = create_access_token(
        {"sub": db_user.email},
        expires_delta=timedelta(seconds=max_age) if user.remember_me else None,
    )

    # Устанавливаем куку на переданном объекте response
    response.set_cookie(
        key="token",
        value=access_token,
        httponly=True,
        secure=True,
        samesite="strict",
        max_age=max_age,
        path="/"
    )

    return {"message": "Успешный вход"}

@router.post("/register/")
def register_user(user: UserCreate, response: Response, db: Session = Depends(get_db)):
    existing_user = db.query(User).filter(User.email == user.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email уже используется")

    hashed_password = hash_password(user.password)
    new_user = User(
        username=user.username,
        email=user.email,
        hashed_password=hashed_password,
        is_active=True,
        created_at=datetime.utcnow()
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    access_token = create_access_token({"sub": new_user.email})

    response.set_cookie(
        key="token",
        value=access_token,
        httponly=True,
        secure=True,
        samesite="strict",
        max_age=86400,
        path="/"
    )

    return {"message": "Регистрация успешна"}

@router.post("/logout/")
def logout_user(response: Response):
    response.delete_cookie(key="token", path="/")
    return {"message": "Вы вышли из системы"}

@router.get("/me")
def get_current_user_info(user: User = Depends(get_current_user)):
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "avatarId": user.avatar_id
    }


class UserProfileUpdate(BaseModel):
    username: Optional[str] = None
    avatarId: Optional[int] = None

    class Config:
        from_attributes = True
        field_customization = {
            "avatarId": "avatar_id"  # Имя в JSON: имя в БД
        }


@router.put("/me/update")
def update_user_profile(
        data: UserProfileUpdate,
        user: User = Depends(get_current_user),
        db: Session = Depends(get_db)
):
    """Обновление данных профиля пользователя"""
    changes_made = False

    print(f"Запрос на обновление профиля: {data.dict()}")
    print(f"Текущий пользователь: {user.id}, {user.username}")

    # Проверка и обновление имени пользователя (только если оно указано в запросе)
    if hasattr(data, 'username') and data.username is not None:
        if data.username != user.username:
            existing_user = db.query(User).filter(User.username == data.username).first()
            if existing_user:
                raise HTTPException(status_code=400, detail="Имя пользователя уже занято")

            user.username = data.username
            changes_made = True
            print(f"Имя пользователя обновлено: {data.username}")

    # Обновление аватарки - только если поле явно присутствует в запросе
    if hasattr(data, 'avatarId'):
        avatar_changed = False

        if data.avatarId is not None:
            # Проверка валидности ID аватарки
            if data.avatarId > 0 and data.avatarId <= 29:
                if user.avatar_id != data.avatarId:
                    user.avatar_id = data.avatarId
                    avatar_changed = True
                    print(f"Аватар обновлен: {data.avatarId}")
            else:
                raise HTTPException(status_code=400, detail="Недопустимый ID аватарки")
        else:
            # Если avatarId равен None и у пользователя есть аватарка, удаляем ее
            if user.avatar_id is not None:
                user.avatar_id = None
                avatar_changed = True
                print("Аватар удален")

        changes_made = changes_made or avatar_changed

    # Если изменения были внесены, сохраняем их
    if changes_made:
        db.commit()
        db.refresh(user)
        print("Изменения сохранены в базе данных")
    else:
        print("Нет изменений для сохранения")

    print(f"Обновлённые данные: username={user.username}, avatar_id={user.avatar_id}")

    # Возвращаем обновленные данные в формате, совместимом с /api/me
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "avatarId": user.avatar_id,
        "message": "Профиль успешно обновлен" if changes_made else "Нет изменений для сохранения"
    }