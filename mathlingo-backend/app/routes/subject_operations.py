from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.models import Subject, Task, AdventureMap
from app.auth import get_admin_current_user

router = APIRouter(prefix="/admin/subject-ops", tags=["subject_operations"])


@router.delete("/{subject_id}")
async def delete_subject_operation(
        subject_id: int,
        db: Session = Depends(get_db),
        current_admin=Depends(get_admin_current_user)
):
    """Simple operation to delete a subject by ID"""

    # Check if subject exists
    subject = db.query(Subject).filter(Subject.id == subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    # Update tasks to remove this subject_id
    try:
        # Remove subject_id from tasks
        db.query(Task).filter(Task.subject_id == subject_id).update(
            {"subject_id": None}, synchronize_session=False
        )
        db.commit()

        # Remove subject_id from adventure maps
        # NOTE: This is a destructive operation that breaks referential integrity
        # It should be used only as a workaround when the proper cascade deletion fails
        db.query(AdventureMap).filter(AdventureMap.subject_id == subject_id).update(
            {"subject_id": None}, synchronize_session=False
        )
        db.commit()

        # Delete the subject
        db.delete(subject)
        db.commit()

        return {"message": f"Subject {subject_id} deleted successfully"}

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error deleting subject: {str(e)}")