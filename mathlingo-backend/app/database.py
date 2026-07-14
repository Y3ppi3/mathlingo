import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()

# Берем URL БД из переменных окружения или указываем вручную
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("X Ошибка: DATABASE_URL не найден в .env!")

# pool_pre_ping — проверка "протухшего" соединения перед выдачей из пула
# (например, после простоя дольше wait_timeout на стороне Postgres);
# без него первый запрос на таком соединении падал бы с ошибкой вместо
# прозрачного переподключения. pool_size/max_overflow специфичны для
# QueuePool (реальная БД) — SQLite в тестах использует SingletonThreadPool,
# который эти аргументы не принимает, поэтому применяем только для
# не-SQLite URL (R4).
engine_kwargs = {"pool_pre_ping": True, "pool_recycle": 1800}
if not DATABASE_URL.startswith("sqlite"):
    engine_kwargs.update(pool_size=10, max_overflow=20)

# Создаем движок SQLAlchemy
engine = create_engine(DATABASE_URL, **engine_kwargs)

# Создаем фабрику сессий
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Базовый класс для моделей
Base = declarative_base()

# Функция для получения сессии БД
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
