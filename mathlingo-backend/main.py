
import os
from fastapi import FastAPI, Depends, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from sqlalchemy.orm import Session

from app.database import get_db
from app.routes import users, tasks, admin, gamification, subjects, subject_operations
from app.routes.admin_gamification import router as admin_gamification_router
from app.models import User, Task
from app.auth import get_current_user

app = FastAPI(title="MathLingo API")

#CORS configuration
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
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


@app.get("/api/me")
def get_current_user_info(user: User = Depends(get_current_user)):
    print(f"✅ Запрошен профиль пользователя: {user.username}")
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email
    }


@app.post("/api/logout/")
def logout_user(response: Response):
    response.delete_cookie("token", path="/")
    print("✅ Пользователь вышел из системы, токен удалён")
    return {"message": "Вы успешно вышли из системы"}


# Correctly handle OPTIONS requests
@app.options("/{path:path}")
async def options_route(path: str):
    return JSONResponse(content={"status": "OK"}, status_code=200)