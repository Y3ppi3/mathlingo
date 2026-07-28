# app/config.py
# Единая точка настроек окружения, влияющих на безопасность/сеть.
import os

from dotenv import load_dotenv

load_dotenv()

# APP_ENV управляет «строгостью» окружения. По умолчанию — production:
# любые послабления безопасности нужно включать явно, чтобы прод случайно
# не оказался ослаблен.
APP_ENV = os.getenv("APP_ENV", "production").strip().lower()
IS_LOCAL = APP_ENV in {"local", "dev", "development"}


def _flag(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


# Кука аутентификации `token`.
#   secure=True  — кука уходит только по HTTPS. На http://localhost браузеры
#                  делают исключение, но http://192.168.x.x (LAN) — уже нет,
#                  поэтому для входа по локальной сети нужен secure=False.
#   samesite     — strict в проде; lax локально (безопаснее при заходе с
#                  другого устройства).
# По умолчанию — безопасные значения; в local автоматически ослабляются.
COOKIE_SECURE = _flag("COOKIE_SECURE", default=not IS_LOCAL)
COOKIE_SAMESITE = os.getenv("COOKIE_SAMESITE", "lax" if IS_LOCAL else "strict").strip().lower()


def auth_cookie_kwargs() -> dict:
    """Общие атрибуты куки `token` — единый источник для login/register/logout."""
    return {
        "httponly": True,
        "secure": COOKIE_SECURE,
        "samesite": COOKIE_SAMESITE,
        "path": "/",
    }
