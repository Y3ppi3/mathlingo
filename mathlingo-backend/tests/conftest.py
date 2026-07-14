import os

os.environ["DATABASE_URL"] = "sqlite://"
os.environ["SECRET_KEY"] = "test-secret-key-with-at-least-thirty-two-characters"

import fakeredis
import pytest
from sqlalchemy import create_engine, event
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.models import Admin, Subject, User
from app.services import cache
from main import app


engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)


# SQLite не проверяет FK-констрейнты (в т.ч. ON DELETE CASCADE/SET NULL) без
# этого — без него тесты бы молча пропустили как раз тот класс багов,
# который здесь чинится (R4: DELETE /admin/tasks/{id} падал 500 на
# Postgres из-за отсутствовавшего ON DELETE, но в тестах на SQLite
# ничего не отражало проблему).
@event.listens_for(engine, "connect")
def _enable_sqlite_foreign_keys(dbapi_connection, _):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def client():
    Base.metadata.create_all(bind=engine)
    # Тесты не поднимают реальный Redis — fakeredis подменяет клиент
    # cache.get_client() так же, как override_get_db подменяет БД.
    cache._client = fakeredis.FakeRedis(decode_responses=True)
    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=engine)
    cache._client = None


@pytest.fixture
def db():
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def user(db):
    from app.auth import hash_password

    item = User(
        username="student",
        email="student@example.com",
        hashed_password=hash_password("password123"),
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@pytest.fixture
def admin(db):
    from app.auth import hash_password

    item = Admin(
        username="admin",
        email="admin@example.com",
        hashed_password=hash_password("password123"),
        role="superadmin",
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@pytest.fixture
def content_manager_admin(db):
    from app.auth import hash_password

    item = Admin(
        username="content-manager",
        email="content-manager@example.com",
        hashed_password=hash_password("password123"),
        role="content_manager",
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@pytest.fixture
def teacher_admin(db):
    from app.auth import hash_password

    item = Admin(
        username="teacher",
        email="teacher@example.com",
        hashed_password=hash_password("password123"),
        role="teacher",
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@pytest.fixture
def subject(db):
    item = Subject(name="Derivatives", code="derivatives")
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def authorization_header(admin):
    from app.auth import create_access_token

    token = create_access_token({"sub": admin.email, "role": "admin"})
    return {"Authorization": f"Bearer {token}"}
