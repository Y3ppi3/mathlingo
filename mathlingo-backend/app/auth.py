import os
from datetime import datetime, timedelta
from typing import Optional

import bcrypt
from passlib.handlers.bcrypt import bcrypt_sha256
import jwt
from dotenv import load_dotenv
from fastapi import Request, Depends, HTTPException, status
from jose import JWTError
from passlib.context import CryptContext
from sqlalchemy.orm import Session

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

pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
    bcrypt__rounds=12,
    bcrypt__ident="2b"
)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """
    Generates a JWT token.
    """
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})

    # Print data for debugging
    print(f"\n➡️ Creating access token with data: {to_encode}", flush=True)
    print(f"🔑 Using SECRET_KEY: {SECRET_KEY[:5]}...", flush=True)

    token = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

    # Log token for debugging
    token_preview = token[:20] + "..." if len(token) > 20 else token
    print(f"🔖 Generated token: {token_preview}", flush=True)

    return token


def get_token_from_request(request: Request) -> Optional[str]:
    """
    Получает токен из заголовка Authorization или из куки.
    Возвращает токен или None, если токен не найден.
    """
    # Сначала пробуем получить токен из заголовка Authorization
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        return auth_header.split(" ")[1]

    # Если в заголовке токена нет, пробуем получить его из куки
    return request.cookies.get("token")


def get_admin_current_user(request: Request, db: Session = Depends(get_db)):
    """
    Извлекает администратора из JWT-токена в заголовке Authorization или из куки.
    """
    token = get_token_from_request(request)

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Отсутствует токен авторизации"
        )

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_email = payload.get("sub")
        user_role = payload.get("role")

        # Проверяем роль из токена
        if user_role == "admin":
            admin = db.query(Admin).filter(Admin.email == user_email).first()
            if admin:
                print(f"✅ Авторизован администратор: {admin.email} (ID {admin.id})", flush=True)
                return admin

        # Если роль не админ или админ не найден, проверяем обычного пользователя
        # и смотрим, может ли он иметь права администратора
        user = db.query(User).filter(User.email == user_email).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Пользователь не найден"
            )

        # Проверяем, является ли пользователь также администратором
        admin = db.query(Admin).filter(Admin.email == user.email).first()
        if not admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Доступ запрещен - требуются права администратора"
            )

        return admin

    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Недействительный токен авторизации",
            headers={"WWW-Authenticate": "Bearer"}
        )


def get_current_user(request: Request, db: Session = Depends(get_db)):
    """
    Извлекает пользователя из заголовка Authorization или из куки.
    """
    token = get_token_from_request(request)

    if not token:
        print("⚠️ Ошибка: Токен отсутствует в заголовке и в куки", flush=True)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Токен отсутствует",
            headers={"WWW-Authenticate": "Bearer"}
        )

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_email = payload.get("sub")
        if not user_email:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Недействительный токен"
            )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Недействительный токен",
            headers={"WWW-Authenticate": "Bearer"}
        )

    user = db.query(User).filter(User.email == user_email).first()
    if not user:
        print(f"⚠️ Ошибка: Пользователь {user_email} не найден в БД", flush=True)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Пользователь не найден"
        )

    print(f"✅ Авторизован пользователь: {user.email} (ID {user.id})", flush=True)
    return user