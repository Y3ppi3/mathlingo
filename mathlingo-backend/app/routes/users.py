from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User
from app.schemas import UserCreate, UserRegisterResponse
from app.auth import hash_password, create_access_token

router = APIRouter()


@router.post("/register/", response_model=UserRegisterResponse)
def register_user(user: UserCreate, db: Session = Depends(get_db)):
    print("➡️ Вызван register_user для:", user.email, flush=True)  # ✅ Гарантируем вывод в консоль

    existing_user = db.query(User).filter(User.email == user.email).first()
    if existing_user:
        print("⚠️ Ошибка: Email уже используется", flush=True)
        raise HTTPException(status_code=400, detail="Email уже используется")

    hashed_password = hash_password(user.password)
    print("✅ Пароль захеширован", flush=True)

    new_user = User(
        username=user.username,
        email=user.email,
        hashed_password=hashed_password,
        is_active=True,
        created_at=datetime.utcnow()
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    print("✅ Пользователь создан в БД:", new_user.id, flush=True)

    access_token = create_access_token({"sub": new_user.email})
    print("✅ Созданный токен:", access_token, flush=True)

    response = UserRegisterResponse(
        id=new_user.id,
        username=new_user.username,
        email=new_user.email,
        is_active=new_user.is_active,
        created_at=new_user.created_at,
        token=access_token
    )

    print("📤 Отправляем JSON-ответ:", response, flush=True)
    return response
