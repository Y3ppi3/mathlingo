import os

os.environ["DATABASE_URL"] = "sqlite://"
os.environ["SECRET_KEY"] = "test-secret-key-with-at-least-thirty-two-characters"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.models import Admin, User
from main import app, csrf_tokens


engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
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
    csrf_tokens.clear()
    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=engine)


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
