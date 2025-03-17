from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Task
from app.schemas import TaskCreate, TaskResponse

router = APIRouter()

@router.post("/tasks/", response_model=TaskResponse)
def create_task(task: TaskCreate, db: Session = Depends(get_db)):
    if not task.owner_id:
        raise HTTPException(status_code=400, detail="owner_id is required")

    db_task = Task(
        title=task.title,
        description=task.description,
        owner_id=task.owner_id  # Явно передаём owner_id
    )
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task
