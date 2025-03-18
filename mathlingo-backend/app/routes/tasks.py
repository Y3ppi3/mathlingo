from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Task
from app.schemas import TaskCreate, TaskResponse

router = APIRouter()


@router.post("/tasks/", response_model=TaskResponse)
def create_task(task: TaskCreate, db: Session = Depends(get_db)):
    # Удаляем проверку на обязательное наличие owner_id

    db_task = Task(
        title=task.title,
        description=task.description,
        owner_id=task.owner_id  # owner_id может быть None
    )
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task