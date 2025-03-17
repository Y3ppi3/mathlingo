from datetime import datetime, timedelta
from typing import Optional
import os
import jwt
from fastapi import Request, Depends, HTTPException
from jose import JWTError
from sqlalchemy.orm import Session
from dotenv import load_dotenv
from passlib.context import CryptContext

from app.database import get_db
from app.models import User, Admin

# Загружаем переменные из .env
load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    print("⚠️ Внимание: SECRET_KEY не найден в .env! Используется значение по умолчанию.")
    SECRET_KEY = "supersecretkey"  # Указываем значение по умолчанию

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """
    Генерирует JWT-токен.
    """
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})

    token = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

    # ✅ Логируем создание токена
    log_data = f"\n➡️ Вызван create_access_token:\n" \
               f"   Данные: {data}\n" \
               f"   Токен: {token}\n"

    print(log_data, flush=True)

    # ✅ Записываем в файл (если print не работает в Docker)
    with open("debug.log", "a") as f:
        f.write(log_data)

    return token


def get_admin_current_user(request: Request, db: Session = Depends(get_db)):
    """
    Извлекает администратора из JWT-токена в заголовке Authorization.
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Отсутствует токен авторизации администратора"
        )

    token = auth_header.split(" ")[1]

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_email = payload.get("sub")
        user_role = payload.get("role")

        if not user_email or user_role != "admin":
            raise HTTPException(
                status_code=401,
                detail="Недействительный токен администратора"
            )
    except JWTError:
        raise HTTPException(
            status_code=401,
            detail="Недействительный токен администратора"
        )

    admin = db.query(Admin).filter(Admin.email == user_email).first()
    if not admin:
        print(f"⚠️ Ошибка: Администратор {user_email} не найден в БД", flush=True)
        raise HTTPException(
            status_code=401,
            detail="Администратор не найден"
        )

    print(f"✅ Авторизован администратор: {admin.email} (ID {admin.id})", flush=True)
    return admin


def get_current_user(request: Request, db: Session = Depends(get_db)):
    """
    Извлекает пользователя из куки.
    """
    token = request.cookies.get("token")
    if not token:
        print("⚠️ Ошибка: Токен отсутствует в куки", flush=True)
        raise HTTPException(status_code=401, detail="Токен отсутствует")

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_email = payload.get("sub")
        if not user_email:
            raise HTTPException(status_code=401, detail="Недействительный токен")
    except JWTError:
        raise HTTPException(status_code=401, detail="Недействительный токен")

    user = db.query(User).filter(User.email == user_email).first()
    if not user:
        print(f"⚠️ Ошибка: Пользователь {user_email} не найден в БД", flush=True)
        raise HTTPException(status_code=401, detail="Пользователь не найден")

    print(f"✅ Авторизован пользователь: {user.email} (ID {user.id})", flush=True)
    return user
