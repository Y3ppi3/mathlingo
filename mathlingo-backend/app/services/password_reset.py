# app/services/password_reset.py
"""
R4: сброс пароля. Токен одноразовый и живёт в Redis (TTL), не в БД —
не нужна отдельная таблица/миграция, а истечение и удаление после
использования обрабатывает сам Redis (тот же паттерн, что CSRF-токены,
см. app/services/cache.py и main.py).
"""
import secrets
from typing import Optional

from sqlalchemy.orm import Session

from app.auth import hash_password
from app.models import User
from app.services import cache
from app.services.email import EmailProvider, MockEmailProvider

RESET_TOKEN_TTL = 1800  # 30 минут
RESET_TOKEN_PREFIX = "password_reset:"

RATE_LIMIT_PREFIX = "password_reset_rate:"
RATE_LIMIT_WINDOW = 3600  # 1 час
RATE_LIMIT_MAX_REQUESTS = 3


def _rate_limit_key(email: str) -> str:
    return f"{RATE_LIMIT_PREFIX}{email.lower()}"


def _is_rate_limited(email: str) -> bool:
    """
    Максимум RATE_LIMIT_MAX_REQUESTS запросов на email в RATE_LIMIT_WINDOW —
    без этого /request можно было бы использовать для спама письмами на
    чужой адрес.
    """
    client = cache.get_client()
    key = _rate_limit_key(email)
    count = client.incr(key)
    if count == 1:
        client.expire(key, RATE_LIMIT_WINDOW)
    return count > RATE_LIMIT_MAX_REQUESTS


def request_reset(
    db: Session,
    email: str,
    frontend_base_url: str,
    provider: Optional[EmailProvider] = None,
) -> None:
    """
    Всегда молча отрабатывает, независимо от того, существует ли email —
    иначе эндпоинт можно было бы использовать для перебора зарегистри-
    рованных адресов (user enumeration). Письмо реально уходит только
    если email существует и не превышен rate-limit.
    """
    provider = provider or MockEmailProvider()

    if _is_rate_limited(email):
        return

    user = db.query(User).filter(User.email == email, User.is_active == True).first()
    if not user:
        return

    token = secrets.token_urlsafe(32)
    cache.get_client().setex(f"{RESET_TOKEN_PREFIX}{token}", RESET_TOKEN_TTL, str(user.id))

    reset_link = f"{frontend_base_url}/reset-password?token={token}"
    provider.send(
        to=user.email,
        subject="Восстановление пароля MathLingo",
        body=(
            f"Здравствуйте, {user.username}!\n\n"
            f"Чтобы задать новый пароль, перейдите по ссылке (действует 30 минут):\n"
            f"{reset_link}\n\n"
            f"Если вы не запрашивали сброс пароля — просто проигнорируйте это письмо."
        ),
    )


def confirm_reset(db: Session, token: str, new_password: str) -> bool:
    """True при успехе, False если токен невалиден/истёк. Токен одноразовый — удаляется сразу при чтении."""
    key = f"{RESET_TOKEN_PREFIX}{token}"
    client = cache.get_client()
    user_id = client.get(key)
    if not user_id:
        return False

    client.delete(key)

    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user:
        return False

    user.hashed_password = hash_password(new_password)
    db.commit()
    return True
