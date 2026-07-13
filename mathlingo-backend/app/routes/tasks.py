from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Task, Admin, Subject
from app.schemas import TaskCreate, TaskResponse
from app.auth import get_admin_current_user, require_role

router = APIRouter()


@router.post("/tasks/", response_model=TaskResponse)
def create_task(
    task: TaskCreate,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_role("superadmin", "content_manager"))
):
    subject = db.query(Subject).filter(Subject.code == task.subject).first()

    db_task = Task(
        title=task.title,
        description=task.description,
        subject=task.subject,
        subject_id=subject.id if subject else None,
        owner_id=task.owner_id,  # owner_id может быть None
    )
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task