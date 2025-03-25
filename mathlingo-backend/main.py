
import os
from fastapi import FastAPI, Depends, Response, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import secrets
import time

from sqlalchemy.orm import Session

from app.database import get_db
from app.routes import users, tasks, admin, gamification, subjects, subject_operations
from app.routes.admin_gamification import router as admin_gamification_router
from app.models import User, Task
from app.auth import get_current_user

app = FastAPI(title="MathLingo API")

csrf_tokens = {}

CSRF_TOKEN_EXPIRY = 3600


@app.middleware("http")
async def csrf_protection(request: Request, call_next):
    # Пути, которые не требуют CSRF-защиты
    exempt_paths = ["/api/login/", "/api/register/", "/api/logout/"]

    # Пропускаем проверку CSRF для исключенных путей или для безопасных методов
    if request.url.path in exempt_paths or request.method in ["GET", "HEAD", "OPTIONS"]:
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


#CORS configuration
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://192.168.0.157:5173/",
    "http://192.168.0.157:8000/"
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


@app.get("/")
def home():
    print("➡️ GET / вызван")
    return {"message": "Добро пожаловать в MathLingo API!"}


@app.get("/users/")
def get_users(db: Session = Depends(get_db)):
    print("➡️ GET /users/ вызван")
    return db.query(User).all()


@app.get("/tasks/")
def get_tasks(db: Session = Depends(get_db)):
    print("➡️ GET /tasks/ вызван")
    return db.query(Task).all()
