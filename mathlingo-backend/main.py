import os
from fastapi import FastAPI, Depends, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.database import get_db
from app.routes import users, tasks
from app.models import User, Task
from app.auth import get_current_user

print("✅ Загружен main.py")

app = FastAPI()

# Разрешаем фронту с localhost:5173 обращаться к бекенду
origins = [
    "http://localhost:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,  # Обязательно для работы с куками
    allow_methods=["*"],
    allow_headers=["*"],
)

print("✅ CORS middleware подключен!")

app.include_router(users.router, prefix="/api", tags=["users"])
app.include_router(tasks.router, prefix="/api", tags=["tasks"])

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
