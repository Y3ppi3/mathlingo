
import os
import time
import secrets

from fastapi import FastAPI, Response, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.database import get_db
from app.models import AuditLog
from app.auth import get_admin_current_user_optional
from app.routes import users, tasks, admin, gamification, subjects, subject_operations, skills, game_scenarios
from app.routes.admin_gamification import router as admin_gamification_router

app = FastAPI(title="MathLingo API")

csrf_tokens = {}

CSRF_TOKEN_EXPIRY = 3600


@app.middleware("http")
async def csrf_protection(request: Request, call_next):
    # Пути, которые не требуют CSRF-защиты
    exempt_paths = ["/api/login/", "/api/register/", "/api/logout/"]

    # Админка использует Bearer-токен в заголовке Authorization, а не cookie-сессию,
    # поэтому она не подвержена CSRF (браузер не может подставить этот заголовок сам)
    # и должна быть исключена из проверки независимо от посторонней cookie "token".
    is_admin_path = request.url.path.startswith("/admin")

    # Пропускаем проверку CSRF для исключенных путей, админки или для безопасных методов
    if is_admin_path or request.url.path in exempt_paths or request.method in ["GET", "HEAD", "OPTIONS"]:
        response = await call_next(request)

        # Для запросов, которые возвращают информацию о пользователе, устанавливаем новый CSRF-токен
        if request.url.path == "/api/me" and request.method == "GET":
            auth_token = request.cookies.get("token")
            if auth_token:
                csrf_token = secrets.token_hex(16)
                csrf_tokens[auth_token] = (csrf_token, time.time())
                response.headers["X-CSRF-Token"] = csrf_token

        return response

    # Для методов, изменяющих данные, проверяем CSRF-токен
    if request.method in ["POST", "PUT", "DELETE", "PATCH"]:
        auth_token = request.cookies.get("token")

        # Если пользователь не аутентифицирован, пропускаем проверку CSRF
        if not auth_token:
            return await call_next(request)

        # Получаем CSRF-токен из заголовка
        csrf_token = request.headers.get("X-CSRF-Token")

        # Проверяем наличие CSRF-токена
        if not csrf_token:
            return JSONResponse(
                content={"detail": "CSRF-токен отсутствует"},
                status_code=403
            )

        # Проверяем валидность CSRF-токена
        stored_data = csrf_tokens.get(auth_token)
        if not stored_data or stored_data[0] != csrf_token:
            return JSONResponse(
                content={"detail": "Недействительный CSRF-токен"},
                status_code=403
            )

        # Проверяем, не истек ли срок действия токена
        timestamp = stored_data[1]
        if time.time() - timestamp > CSRF_TOKEN_EXPIRY:
            csrf_tokens.pop(auth_token, None)
            return JSONResponse(
                content={"detail": "Срок действия CSRF-токена истек"},
                status_code=403
            )
    return await call_next(request)


AUDIT_METHODS = {"POST", "PUT", "PATCH", "DELETE"}

# Единственный admin-only мутирующий эндпоинт вне префикса /admin — легаси
# POST /api/tasks/ в app/routes/tasks.py (require_role, но смонтирован под
# /api вместе со студенческими роутами). Явно перечисляем, а не расширяем
# правило до "любой /api путь с admin-ролью", чтобы не аудировать студенческие
# мутации (/api/login/, /api/me/update и т.д.) заодно.
AUDITED_NON_ADMIN_PATHS = {"/api/tasks/"}

# На момент запроса login/register ещё нет токена, поэтому actor_admin_id
# всегда NULL ("аноним") — это архитектурно неизбежно, а не баг. Но потерять
# ЧЕЙ это был login-запрос было бы плохо для security-аудита (нельзя увидеть
# перебор пароля к конкретному аккаунту), поэтому для этих двух путей кладём
# email из тела запроса в entity_id.
LOGIN_LIKE_PATHS = {"/admin/login", "/admin/register"}


def _parse_admin_audit_path(path: str):
    """
    Best-effort разбор <prefix>/<entity_type>[/<id>[/<action>]] — не
    полноценная семантическая классификация, просто удобные для фильтрации
    поля поверх того, что и так есть в path/method.
    """
    prefix = "/admin" if path.startswith("/admin") else "/api"
    segments = [s for s in path[len(prefix):].split("/") if s]
    if not segments:
        return None, None, None

    entity_type = segments[0]
    entity_id = None
    action = None
    if len(segments) >= 2 and segments[1].isdigit():
        entity_id = segments[1]
        if len(segments) >= 3:
            action = segments[2]
    elif len(segments) >= 2:
        action = segments[1]
    return entity_type, entity_id, action


@app.middleware("http")
async def audit_logging(request: Request, call_next):
    """
    Пишет audit_log для КАЖДОГО мутирующего запроса под /admin — успешного
    или нет (включая 401/403 — попытка тоже сигнал). Реализовано мидлварью,
    а не точечными вызовами в эндпоинтах, чтобы покрытие не зависело от
    того, вспомнил ли автор нового роута про логирование (см.
    docs/roadmap/product-technical-plan.md, R1 §1.3 и DoD).
    """
    # Тело запроса нужно прочитать ДО call_next: BaseHTTPMiddleware кэширует
    # поток запроса только в этом порядке (читаешь -> он реплеится вниз по
    # цепочке), а не наоборот — прочитать после call_next уже нечего, поток
    # к этому моменту вычитан обработчиком ниже.
    login_email = None
    if request.url.path in LOGIN_LIKE_PATHS and request.method in AUDIT_METHODS:
        try:
            body = await request.json()
            login_email = body.get("email")
        except Exception:
            pass

    response = await call_next(request)

    is_audited_path = request.url.path.startswith("/admin") or request.url.path in AUDITED_NON_ADMIN_PATHS
    if request.method in AUDIT_METHODS and is_audited_path:
        # Уважаем app.dependency_overrides[get_db], чтобы в тестах мидлварь
        # писала в ту же (тестовую) БД, что и остальное приложение, а не в
        # отдельную "боевую" — мидлварь не проходит через DI и иначе взяла
        # бы реальный get_db в обход подмены.
        db_dependency = app.dependency_overrides.get(get_db, get_db)
        db_gen = db_dependency()
        db = next(db_gen)
        try:
            current_admin = get_admin_current_user_optional(request, db)
            entity_type, entity_id, action = _parse_admin_audit_path(request.url.path)
            if login_email:
                entity_id = login_email
            db.add(AuditLog(
                actor_admin_id=current_admin.id if current_admin else None,
                actor_role=current_admin.role if current_admin else None,
                method=request.method,
                path=request.url.path,
                entity_type=entity_type,
                entity_id=entity_id,
                action=action,
                status_code=response.status_code,
            ))
            db.commit()
        finally:
            try:
                next(db_gen)
            except StopIteration:
                pass

    return response

#CORS configuration
origins = [
    "https://mathlingo.space",
    "https://www.mathlingo.space",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://192.168.0.157:5173",
    "http://192.168.0.157:8000",
    "http://localhost:8000",
    "http://localhost:8001",
    "http://localhost:8080"
    # Добавьте здесь ваши production домены, когда перейдете в production
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,  # Важно для передачи куки
    allow_methods=["*"],     # Разрешаем все методы
    allow_headers=["*"],     # Разрешаем все заголовки
    expose_headers=["Content-Type", "Authorization"],
    max_age=86400,           # Кэширование preflight запросов на 24 часа
)

# Regular routes
app.include_router(admin.router)
app.include_router(users.router, prefix="/api", tags=["users"])
app.include_router(tasks.router, prefix="/api", tags=["tasks"])
app.include_router(subjects.router, prefix="/api/subjects", tags=["subjects"])
app.include_router(gamification.router, prefix="/gamification")
app.include_router(admin_gamification_router)
app.include_router(subject_operations.router)
app.include_router(skills.router)
app.include_router(game_scenarios.router)


@app.get("/")
def home():
    return {"message": "Добро пожаловать в MathLingo API!"}
