# app/routes/password_reset.py
"""
R4: forgot-password. Email-провайдер сейчас MockEmailProvider (пишет
письмо в лог) — реальный SMTP/API-провайдер не выбран, это отдельное
решение (см. docstring app/services/email.py). Бизнес-логика и токены
уже полностью рабочие и покрыты тестами независимо от выбора провайдера.
"""
import os

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import PasswordResetConfirm, PasswordResetRequest
from app.services import password_reset

router = APIRouter(prefix="/api/password-reset", tags=["password_reset"])

FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL", "http://localhost:5173")

MIN_PASSWORD_LENGTH = 8


@router.post("/request", status_code=status.HTTP_204_NO_CONTENT)
def request_password_reset(body: PasswordResetRequest, db: Session = Depends(get_db)):
    """
    Всегда 204, независимо от того, существует ли email — иначе ответ
    сам по себе раскрывал бы, какие адреса зарегистрированы (user
    enumeration). См. app/services/password_reset.request_reset.
    """
    password_reset.request_reset(db, body.email, FRONTEND_BASE_URL)
    return None


@router.post("/confirm")
def confirm_password_reset(body: PasswordResetConfirm, db: Session = Depends(get_db)):
    if len(body.new_password) < MIN_PASSWORD_LENGTH:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Пароль должен быть не короче {MIN_PASSWORD_LENGTH} символов",
        )

    success = password_reset.confirm_reset(db, body.token, body.new_password)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ссылка недействительна или истекла — запросите сброс пароля заново",
        )
    return {"message": "Пароль успешно изменён"}
