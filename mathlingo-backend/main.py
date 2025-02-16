import os
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.database import get_db
from app.routes import users  # ✅ Проверяем импорт

from app.models import User, Task

print("✅ Загружен main.py")  # ✅ Проверяем, запускается ли FastAPI
print("✅ Импортирован users.py:", users)  # ✅ Проверяем, загружен ли модуль users

app = FastAPI()

app.include_router(users.router, prefix="/api", tags=["users"])  # ✅ FastAPI подключает маршруты

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def home():
    print("➡️ GET / вызван")  # ✅ Логируем вызов главной страницы
    return {"message": "Добро пожаловать в MathLingo API!"}

@app.get("/users/")
def get_users(db: Session = Depends(get_db)):
    print("➡️ GET /users/ вызван")  # ✅ Логируем вызов API
    return db.query(User).all()

@app.get("/tasks/")
def get_tasks(db: Session = Depends(get_db)):
    print("➡️ GET /tasks/ вызван")  # ✅ Логируем вызов API
    return db.query(Task).all()
