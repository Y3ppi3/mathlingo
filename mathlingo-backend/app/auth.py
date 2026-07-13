import os
from datetime import datetime, timedelta
from typing import Optional

import bcrypt
from passlib.handlers.bcrypt import bcrypt_sha256
import jwt
from dotenv import load_dotenv
from fastapi import Request, Depends, HTTPException, status
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, Admin

# Загружаем переменные из .env
load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError(
        "SECRET_KEY не найден в .env! Задайте SECRET_KEY перед запуском "
        "приложения — использование значения по умолчанию небезопасно."
    )

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

    token = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

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

    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Недействительный токен авторизации",
            headers={"WWW-Authenticate": "Bearer"}
        )


def require_role(*roles: str):
    """
    Dependency factory для RBAC: пропускает только админов с одной из
    перечисленных ролей. Проверяет Admin.role из БД (а не claim из JWT),
    чтобы смена/понижение роли действовала немедленно, а не только после
    истечения уже выданного токена.
    """
    def dependency(current_admin: Admin = Depends(get_admin_current_user)) -> Admin:
        if current_admin.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Недостаточно прав для выполнения этого действия",
            )
        return current_admin

    return dependency


def get_admin_current_user_optional(request: Request, db: Session = Depends(get_db)) -> Optional[Admin]:
    """
    Как get_admin_current_user, но возвращает None вместо исключения,
    если токен отсутствует/недействителен или пользователь не админ.
    Используется там, где отсутствие авторизации — это не ошибка, а один
    из допустимых сценариев (например, bootstrap первого администратора).
    """
    try:
        return get_admin_current_user(request, db)
    except HTTPException:
        return None


def get_current_user(request: Request, db: Session = Depends(get_db)):
    """
    Извлекает пользователя из заголовка Authorization или из куки.
    """
    token = get_token_from_request(request)

    if not token:
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
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Недействительный токен",
            headers={"WWW-Authenticate": "Bearer"}
        )

    user = db.query(User).filter(User.email == user_email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Пользователь не найден"
        )

    return user