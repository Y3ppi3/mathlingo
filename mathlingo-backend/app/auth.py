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
from app.models import User

# Загружаем переменные из .env
load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY", "supersecretkey")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    log_data = f"➡️ Вызван create_access_token с данными: {data}\n"

    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})

    token = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    log_data += f"✅ Создан токен: {token}\n"

    # ✅ Записываем в файл, если `print()` не работает
    with open("debug.log", "a") as f:
        f.write(log_data)

    return token


def get_current_user(request: Request, db: Session = Depends(get_db)):
    """
    Извлекает пользователя из куки.
    """
    token = request.cookies.get("token")
    if not token:
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
        raise HTTPException(status_code=401, detail="Пользователь не найден")

    return user