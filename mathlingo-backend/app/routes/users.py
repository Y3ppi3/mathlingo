from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.schemas import UserLogin, UserCreate
from app.auth import verify_password, hash_password, create_access_token, get_current_user

router = APIRouter()

@router.post("/login/")
def login_user(user: UserLogin, response: Response, db: Session = Depends(get_db)):
    print("➡️ Вызван login_user для:", user.email, flush=True)

    db_user = db.query(User).filter(User.email == user.email).first()
    if not db_user or not verify_password(user.password, db_user.hashed_password):
        print("⚠️ Ошибка: Неверный email или пароль", flush=True)
        raise HTTPException(status_code=400, detail="Неверный email или пароль")

    access_token = create_access_token({"sub": db_user.email})

    # Устанавливаем куку на переданном объекте response
    response.set_cookie(
        key="token",
        value=access_token,
        httponly=True,        # Кука недоступна для JS
        secure=False,         # Для разработки на HTTP; в продакшене ставь True и используй HTTPS
        samesite="lax",       # Lowercase 'lax' to match standard
        path="/"
    )

    print("✅ Успешный вход, токен установлен:", access_token[:30], "...")
    # Include token in response for debugging purposes
    return {"message": "Успешный вход", "token": access_token}

@router.post("/register/")
def register_user(user: UserCreate, response: Response, db: Session = Depends(get_db)):
    print("➡️ Вызван register_user для:", user.email, flush=True)

    existing_user = db.query(User).filter(User.email == user.email).first()
    if existing_user:
        print("⚠️ Ошибка: Email уже используется", flush=True)
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
        secure=False,
        samesite="Lax",
        path="/"
    )

    print("✅ Регистрация успешна, токен установлен:", access_token[:30], "...")
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
        "email": user.email
    }
