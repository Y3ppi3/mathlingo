from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import JSONResponse
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

    response.set_cookie(
        key="token",
        value=access_token,
        httponly=True,
        secure=False,  # На HTTPS ставим True
        samesite="None",  # ❗ ОБЯЗАТЕЛЬНО None, иначе не передается на другой порт (localhost:5173)
        domain="localhost",  # ❗ ОБЯЗАТЕЛЬНО, чтобы куки были доступны фронту
        path="/"  # Глобальный путь
    )

    print("✅ Успешный вход, токен установлен:", access_token[:30], "...")

    return JSONResponse(content={"message": "Успешный вход"})



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

    # ✅ Генерация токена
    access_token = create_access_token({"sub": new_user.email})

    response.set_cookie(
        key="token",
        value=access_token,
        httponly=True,
        secure=False,  # На HTTPS ставим True
        samesite="None",  # ❗ ОБЯЗАТЕЛЬНО None, иначе не передается на другой порт (localhost:5173)
        domain="localhost",  # ❗ ОБЯЗАТЕЛЬНО, чтобы куки были доступны фронту
        path="/"  # Глобальный путь
    )

    print("✅ Регистрация успешна, токен установлен:", access_token[:30], "...")

    return JSONResponse(content={"message": "Регистрация успешна"})


@router.post("/logout/")
def logout_user(response: Response):
    response.delete_cookie(
        key="token",
        path="/"
    )
    return {"message": "Вы вышли из системы"}


@router.get("/me")
def get_current_user_info(user: User = Depends(get_current_user)):
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email
    }
