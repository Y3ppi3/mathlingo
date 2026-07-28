# app/routes/tutors.py
# Платформа репетиторов, Фаза 1: маркетплейс профилей + связь «репетитор↔ученик».
# Фаза 3: задания репетитора ученику (tutor_assignments).
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, TutorProfile, TutorStudent, TutorAssignment, TutorSession, TutorContent
from app.auth import get_current_user
from app.services import student_dashboard
from app.schemas import StudentDashboardResponse

router = APIRouter()


# ---------- Схемы ----------

class TutorProfileIn(BaseModel):
    headline: str = Field(..., min_length=3, max_length=140)
    bio: Optional[str] = Field(None, max_length=4000)
    subjects: Optional[List[str]] = None
    hourly_rate: Optional[int] = Field(None, ge=0, le=1_000_000)
    is_listed: bool = True


class TutorCard(BaseModel):
    user_id: int
    username: str
    avatar_id: Optional[int] = None
    headline: str
    bio: Optional[str] = None
    subjects: Optional[List[str]] = None
    hourly_rate: Optional[int] = None
    is_listed: bool
    # Статус связи с текущим пользователем: none | pending | active
    connection_status: str = "none"
    students_count: Optional[int] = None


class StudentCard(BaseModel):
    student_id: int
    username: str
    email: str
    avatar_id: Optional[int] = None
    status: str
    created_at: Optional[str] = None


class ConnectionCard(BaseModel):
    tutor_id: int
    username: str
    avatar_id: Optional[int] = None
    headline: str
    status: str


class TutorStudentDashboard(BaseModel):
    student: StudentCard
    dashboard: StudentDashboardResponse


class AssignmentIn(BaseModel):
    kind: str = Field("custom")
    title: str = Field(..., min_length=1, max_length=200)
    link: Optional[str] = Field(None, max_length=500)
    note: Optional[str] = Field(None, max_length=2000)
    due_at: Optional[datetime] = None


class AssignmentCard(BaseModel):
    id: int
    kind: str
    title: str
    link: Optional[str] = None
    note: Optional[str] = None
    due_at: Optional[str] = None
    status: str
    created_at: Optional[str] = None
    completed_at: Optional[str] = None
    # Заполняется только в списке ученика (у него задания от разных репетиторов).
    tutor_username: Optional[str] = None
    tutor_avatar_id: Optional[int] = None


class SessionIn(BaseModel):
    starts_at: datetime
    duration_min: int = Field(60, ge=15, le=480)
    title: Optional[str] = Field(None, max_length=200)
    meeting_url: Optional[str] = Field(None, max_length=500)
    note: Optional[str] = Field(None, max_length=2000)


class SessionCard(BaseModel):
    id: int
    starts_at: str
    duration_min: int
    title: Optional[str] = None
    meeting_url: Optional[str] = None
    note: Optional[str] = None
    status: str
    # Одна из сторон — в зависимости от того, чья агенда запрошена.
    student_id: Optional[int] = None
    student_username: Optional[str] = None
    student_avatar_id: Optional[int] = None
    tutor_username: Optional[str] = None
    tutor_avatar_id: Optional[int] = None


class ContentIn(BaseModel):
    kind: str = Field("material")
    title: str = Field(..., min_length=1, max_length=200)
    body: Optional[str] = Field(None, max_length=20000)
    answer: Optional[str] = Field(None, max_length=2000)
    attachment_url: Optional[str] = Field(None, max_length=500)


class ContentCard(BaseModel):
    id: int
    kind: str
    title: str
    body: Optional[str] = None
    answer: Optional[str] = None
    attachment_url: Optional[str] = None
    created_at: Optional[str] = None
    # Имя автора — заполняется во просмотрщике (ученик видит, чей материал).
    tutor_username: Optional[str] = None


# ---------- Вспомогательное ----------

def _connection_status(db: Session, tutor_user_id: int, student_user_id: int) -> str:
    link = (
        db.query(TutorStudent)
        .filter(TutorStudent.tutor_id == tutor_user_id, TutorStudent.student_id == student_user_id)
        .first()
    )
    return link.status if link else "none"


def _iso_utc(dt: Optional[datetime]) -> Optional[str]:
    """ISO-строка с явной зоной. Время в БД наивное и в UTC — без метки зоны фронт
    принял бы его за локальное и сдвинул на часовой пояс. Помечаем как UTC, тогда
    new Date(...) на фронте корректно переведёт в локальное время пользователя."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


def _require_active_link(db: Session, tutor_user_id: int, student_user_id: int) -> TutorStudent:
    """Активная связь репетитор↔ученик или 403 — общий гейт для работы с учеником."""
    link = (
        db.query(TutorStudent)
        .filter(
            TutorStudent.tutor_id == tutor_user_id,
            TutorStudent.student_id == student_user_id,
            TutorStudent.status == "active",
        )
        .first()
    )
    if link is None:
        raise HTTPException(status_code=403, detail="Нет доступа к этому ученику")
    return link


def _assignment_card(a: TutorAssignment, tutor: Optional[User] = None) -> AssignmentCard:
    return AssignmentCard(
        id=a.id,
        kind=a.kind,
        title=a.title,
        link=a.link,
        note=a.note,
        due_at=_iso_utc(a.due_at),
        status=a.status,
        created_at=a.created_at.isoformat() if a.created_at else None,
        completed_at=a.completed_at.isoformat() if a.completed_at else None,
        tutor_username=tutor.username if tutor else None,
        tutor_avatar_id=tutor.avatar_id if tutor else None,
    )


def _content_card(c: TutorContent, *, tutor: Optional[User] = None) -> ContentCard:
    return ContentCard(
        id=c.id,
        kind=c.kind,
        title=c.title,
        body=c.body,
        answer=c.answer,
        attachment_url=c.attachment_url,
        created_at=_iso_utc(c.created_at),
        tutor_username=tutor.username if tutor else None,
    )


def _session_card(s: TutorSession, *, student: Optional[User] = None, tutor: Optional[User] = None) -> SessionCard:
    return SessionCard(
        id=s.id,
        starts_at=_iso_utc(s.starts_at) or "",
        duration_min=s.duration_min,
        title=s.title,
        meeting_url=s.meeting_url,
        note=s.note,
        status=s.status,
        student_id=student.id if student else None,
        student_username=student.username if student else None,
        student_avatar_id=student.avatar_id if student else None,
        tutor_username=tutor.username if tutor else None,
        tutor_avatar_id=tutor.avatar_id if tutor else None,
    )


def _card(db: Session, prof: TutorProfile, viewer_id: int) -> TutorCard:
    active_count = (
        db.query(TutorStudent)
        .filter(TutorStudent.tutor_id == prof.user_id, TutorStudent.status == "active")
        .count()
    )
    return TutorCard(
        user_id=prof.user_id,
        username=prof.user.username,
        avatar_id=prof.user.avatar_id,
        headline=prof.headline,
        bio=prof.bio,
        subjects=prof.subjects,
        hourly_rate=prof.hourly_rate,
        is_listed=prof.is_listed,
        connection_status=_connection_status(db, prof.user_id, viewer_id),
        students_count=active_count,
    )


# ---------- Маркетплейс ----------

@router.get("/tutors", response_model=List[TutorCard])
def list_tutors(db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    """Каталог репетиторов (только опубликованные), кроме своего профиля."""
    profiles = (
        db.query(TutorProfile)
        .filter(TutorProfile.is_listed == True, TutorProfile.user_id != current.id)  # noqa: E712
        .all()
    )
    return [_card(db, p, current.id) for p in profiles]


# --- Свой профиль репетитора (specific-роуты ДО /tutors/{id}) ---

@router.get("/tutors/me/profile", response_model=Optional[TutorCard])
def my_tutor_profile(db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    """Профиль репетитора текущего пользователя (null, если он не репетитор)."""
    prof = db.query(TutorProfile).filter(TutorProfile.user_id == current.id).first()
    return _card(db, prof, current.id) if prof else None


@router.put("/tutors/me/profile", response_model=TutorCard)
def upsert_tutor_profile(
    payload: TutorProfileIn,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    """Создать/обновить свой профиль репетитора (= «стать репетитором»)."""
    prof = db.query(TutorProfile).filter(TutorProfile.user_id == current.id).first()
    if prof is None:
        prof = TutorProfile(user_id=current.id)
        db.add(prof)
    prof.headline = payload.headline
    prof.bio = payload.bio
    prof.subjects = payload.subjects
    prof.hourly_rate = payload.hourly_rate
    prof.is_listed = payload.is_listed
    db.commit()
    db.refresh(prof)
    return _card(db, prof, current.id)


@router.get("/tutors/me/students", response_model=List[StudentCard])
def my_students(db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    """Ученики текущего репетитора (заявки + принятые)."""
    links = (
        db.query(TutorStudent)
        .filter(TutorStudent.tutor_id == current.id)
        .order_by(TutorStudent.created_at.desc())
        .all()
    )
    out: List[StudentCard] = []
    for link in links:
        student = db.query(User).filter(User.id == link.student_id).first()
        if not student:
            continue
        out.append(StudentCard(
            student_id=student.id,
            username=student.username,
            email=student.email,
            avatar_id=student.avatar_id,
            status=link.status,
            created_at=link.created_at.isoformat() if link.created_at else None,
        ))
    return out


@router.post("/tutors/me/students/{student_user_id}/accept", response_model=StudentCard)
def accept_student(
    student_user_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    """Репетитор принимает заявку ученика (pending → active)."""
    link = (
        db.query(TutorStudent)
        .filter(TutorStudent.tutor_id == current.id, TutorStudent.student_id == student_user_id)
        .first()
    )
    if link is None:
        raise HTTPException(status_code=404, detail="Заявка не найдена")
    link.status = "active"
    db.commit()
    student = db.query(User).filter(User.id == student_user_id).first()
    return StudentCard(
        student_id=student.id,
        username=student.username,
        email=student.email,
        avatar_id=student.avatar_id,
        status=link.status,
        created_at=link.created_at.isoformat() if link.created_at else None,
    )


@router.get("/tutors/me/students/{student_user_id}/dashboard", response_model=TutorStudentDashboard)
def student_dashboard_for_tutor(
    student_user_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    """
    Прогресс ученика для репетитора (Фаза 2). Доступен только по активной связи
    — иначе чужие данные были бы видны любому. Переиспользует тот же сервис
    student_dashboard, что и собственный дашборд ученика.
    """
    link = (
        db.query(TutorStudent)
        .filter(
            TutorStudent.tutor_id == current.id,
            TutorStudent.student_id == student_user_id,
            TutorStudent.status == "active",
        )
        .first()
    )
    if link is None:
        raise HTTPException(status_code=403, detail="Нет доступа к прогрессу этого ученика")

    student = db.query(User).filter(User.id == student_user_id).first()
    if student is None:
        raise HTTPException(status_code=404, detail="Ученик не найден")

    return TutorStudentDashboard(
        student=StudentCard(
            student_id=student.id,
            username=student.username,
            email=student.email,
            avatar_id=student.avatar_id,
            status=link.status,
            created_at=link.created_at.isoformat() if link.created_at else None,
        ),
        dashboard=StudentDashboardResponse(
            activity=student_dashboard.activity_stats(db, student_user_id),
            recent_activity=student_dashboard.recent_activity(db, student_user_id),
            topics_progress=student_dashboard.topics_progress(db, student_user_id),
        ),
    )


# --- Задания ученику (Фаза 3) ---

@router.get("/tutors/me/students/{student_user_id}/assignments", response_model=List[AssignmentCard])
def list_student_assignments(
    student_user_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    """Задания, которые репетитор назначил этому ученику (только по активной связи)."""
    _require_active_link(db, current.id, student_user_id)
    items = (
        db.query(TutorAssignment)
        .filter(TutorAssignment.tutor_id == current.id, TutorAssignment.student_id == student_user_id)
        .order_by(TutorAssignment.created_at.desc())
        .all()
    )
    return [_assignment_card(a) for a in items]


@router.post("/tutors/me/students/{student_user_id}/assignments", response_model=AssignmentCard, status_code=201)
def create_assignment(
    student_user_id: int,
    payload: AssignmentIn,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    """Назначить ученику задание (игра / номер экзамена / произвольное)."""
    _require_active_link(db, current.id, student_user_id)
    kind = payload.kind if payload.kind in TutorAssignment.KINDS else "custom"
    # Ссылка — только внутренний путь фронта; чужие URL не пускаем (это ссылка,
    # по которой ученик кликает у себя в кабинете).
    link = payload.link.strip() if payload.link else None
    if link and not link.startswith("/"):
        raise HTTPException(status_code=422, detail="Ссылка должна быть внутренним путём")
    a = TutorAssignment(
        tutor_id=current.id,
        student_id=student_user_id,
        kind=kind,
        title=payload.title.strip(),
        link=link,
        note=payload.note.strip() if payload.note else None,
        due_at=payload.due_at,
        status="assigned",
    )
    db.add(a)
    db.commit()
    db.refresh(a)
    return _assignment_card(a)


@router.delete("/tutors/me/assignments/{assignment_id}", status_code=204)
def delete_assignment(
    assignment_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    """Репетитор снимает своё задание."""
    a = (
        db.query(TutorAssignment)
        .filter(TutorAssignment.id == assignment_id, TutorAssignment.tutor_id == current.id)
        .first()
    )
    if a is None:
        raise HTTPException(status_code=404, detail="Задание не найдено")
    db.delete(a)
    db.commit()
    return None


# --- Занятия/конференции (Фаза 5) ---

@router.get("/tutors/me/sessions", response_model=List[SessionCard])
def my_agenda(db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    """Календарь репетитора: все запланированные занятия со всеми учениками (по времени)."""
    items = (
        db.query(TutorSession)
        .filter(TutorSession.tutor_id == current.id, TutorSession.status == "scheduled")
        .order_by(TutorSession.starts_at.asc())
        .all()
    )
    students = {u.id: u for u in db.query(User).filter(
        User.id.in_([s.student_id for s in items] or [0])
    ).all()}
    return [_session_card(s, student=students.get(s.student_id)) for s in items]


@router.get("/tutors/me/students/{student_user_id}/sessions", response_model=List[SessionCard])
def student_sessions(
    student_user_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    """Занятия репетитора с конкретным учеником (для страницы прогресса)."""
    _require_active_link(db, current.id, student_user_id)
    student = db.query(User).filter(User.id == student_user_id).first()
    items = (
        db.query(TutorSession)
        .filter(
            TutorSession.tutor_id == current.id,
            TutorSession.student_id == student_user_id,
            TutorSession.status == "scheduled",
        )
        .order_by(TutorSession.starts_at.asc())
        .all()
    )
    return [_session_card(s, student=student) for s in items]


@router.post("/tutors/me/students/{student_user_id}/sessions", response_model=SessionCard, status_code=201)
def create_session(
    student_user_id: int,
    payload: SessionIn,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    """Запланировать занятие с учеником."""
    _require_active_link(db, current.id, student_user_id)
    url = payload.meeting_url.strip() if payload.meeting_url else None
    if url and not (url.startswith("http://") or url.startswith("https://")):
        raise HTTPException(status_code=422, detail="Ссылка на встречу должна начинаться с http(s)://")
    s = TutorSession(
        tutor_id=current.id,
        student_id=student_user_id,
        starts_at=payload.starts_at,
        duration_min=payload.duration_min,
        title=payload.title.strip() if payload.title else None,
        meeting_url=url,
        note=payload.note.strip() if payload.note else None,
        status="scheduled",
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    student = db.query(User).filter(User.id == student_user_id).first()
    return _session_card(s, student=student)


@router.delete("/tutors/me/sessions/{session_id}", status_code=204)
def cancel_session(
    session_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    """Репетитор отменяет занятие."""
    s = (
        db.query(TutorSession)
        .filter(TutorSession.id == session_id, TutorSession.tutor_id == current.id)
        .first()
    )
    if s is None:
        raise HTTPException(status_code=404, detail="Занятие не найдено")
    db.delete(s)
    db.commit()
    return None


@router.put("/tutors/me/sessions/{session_id}", response_model=SessionCard)
def update_session(
    session_id: int,
    payload: SessionIn,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    """Перенести/отредактировать занятие (дата/время, длительность, тема, ссылка)."""
    s = (
        db.query(TutorSession)
        .filter(TutorSession.id == session_id, TutorSession.tutor_id == current.id)
        .first()
    )
    if s is None:
        raise HTTPException(status_code=404, detail="Занятие не найдено")
    url = payload.meeting_url.strip() if payload.meeting_url else None
    if url and not (url.startswith("http://") or url.startswith("https://")):
        raise HTTPException(status_code=422, detail="Ссылка на встречу должна начинаться с http(s)://")
    s.starts_at = payload.starts_at
    s.duration_min = payload.duration_min
    s.title = payload.title.strip() if payload.title else None
    s.meeting_url = url
    s.note = payload.note.strip() if payload.note else None
    db.commit()
    db.refresh(s)
    student = db.query(User).filter(User.id == s.student_id).first()
    return _session_card(s, student=student)


# --- Свой контент репетитора (Фаза 4) ---

def _validate_attachment(url: Optional[str]) -> Optional[str]:
    url = url.strip() if url else None
    if url and not (url.startswith("http://") or url.startswith("https://")):
        raise HTTPException(status_code=422, detail="Ссылка на файл должна начинаться с http(s)://")
    return url


@router.get("/tutors/me/content", response_model=List[ContentCard])
def my_content(db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    """Библиотека собственных задач/материалов репетитора."""
    items = (
        db.query(TutorContent)
        .filter(TutorContent.tutor_id == current.id)
        .order_by(TutorContent.created_at.desc())
        .all()
    )
    return [_content_card(c) for c in items]


@router.post("/tutors/me/content", response_model=ContentCard, status_code=201)
def create_content(
    payload: ContentIn,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    """Создать свою задачу/материал."""
    kind = payload.kind if payload.kind in TutorContent.KINDS else "material"
    c = TutorContent(
        tutor_id=current.id,
        kind=kind,
        title=payload.title.strip(),
        body=payload.body.strip() if payload.body else None,
        answer=payload.answer.strip() if payload.answer else None,
        attachment_url=_validate_attachment(payload.attachment_url),
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return _content_card(c)


@router.put("/tutors/me/content/{content_id}", response_model=ContentCard)
def update_content(
    content_id: int,
    payload: ContentIn,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    """Отредактировать свой материал."""
    c = (
        db.query(TutorContent)
        .filter(TutorContent.id == content_id, TutorContent.tutor_id == current.id)
        .first()
    )
    if c is None:
        raise HTTPException(status_code=404, detail="Материал не найден")
    c.kind = payload.kind if payload.kind in TutorContent.KINDS else "material"
    c.title = payload.title.strip()
    c.body = payload.body.strip() if payload.body else None
    c.answer = payload.answer.strip() if payload.answer else None
    c.attachment_url = _validate_attachment(payload.attachment_url)
    db.commit()
    db.refresh(c)
    return _content_card(c)


@router.delete("/tutors/me/content/{content_id}", status_code=204)
def delete_content(
    content_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    """Удалить свой материал."""
    c = (
        db.query(TutorContent)
        .filter(TutorContent.id == content_id, TutorContent.tutor_id == current.id)
        .first()
    )
    if c is None:
        raise HTTPException(status_code=404, detail="Материал не найден")
    db.delete(c)
    db.commit()
    return None


@router.get("/tutors/content/{content_id}", response_model=ContentCard)
def view_content(
    content_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    """
    Просмотр материала: доступен автору (репетитору) и его активным ученикам.
    Через него открывается назначенный материал (kind=material) у ученика.
    """
    c = db.query(TutorContent).filter(TutorContent.id == content_id).first()
    if c is None:
        raise HTTPException(status_code=404, detail="Материал не найден")
    if c.tutor_id != current.id:
        # не автор — нужна активная связь ученик↔этот репетитор
        link = (
            db.query(TutorStudent)
            .filter(
                TutorStudent.tutor_id == c.tutor_id,
                TutorStudent.student_id == current.id,
                TutorStudent.status == "active",
            )
            .first()
        )
        if link is None:
            raise HTTPException(status_code=403, detail="Нет доступа к материалу")
    tutor = db.query(User).filter(User.id == c.tutor_id).first()
    return _content_card(c, tutor=tutor)


# --- Связи ученика ---

@router.get("/me/tutors", response_model=List[ConnectionCard])
def my_tutors(db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    """Репетиторы, к которым текущий ученик отправил заявку / уже связан."""
    links = (
        db.query(TutorStudent)
        .filter(TutorStudent.student_id == current.id)
        .order_by(TutorStudent.created_at.desc())
        .all()
    )
    out: List[ConnectionCard] = []
    for link in links:
        prof = db.query(TutorProfile).filter(TutorProfile.user_id == link.tutor_id).first()
        tutor = db.query(User).filter(User.id == link.tutor_id).first()
        if not tutor:
            continue
        out.append(ConnectionCard(
            tutor_id=tutor.id,
            username=tutor.username,
            avatar_id=tutor.avatar_id,
            headline=prof.headline if prof else "",
            status=link.status,
        ))
    return out


@router.get("/me/assignments", response_model=List[AssignmentCard])
def my_assignments(db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    """Задания текущего ученика от всех его репетиторов (сначала невыполненные)."""
    items = (
        db.query(TutorAssignment)
        .filter(TutorAssignment.student_id == current.id)
        .order_by(TutorAssignment.status.desc(), TutorAssignment.created_at.desc())
        .all()
    )
    # status.desc(): "assigned" > "done" — активные задания оказываются сверху.
    tutors = {u.id: u for u in db.query(User).filter(
        User.id.in_([a.tutor_id for a in items] or [0])
    ).all()}
    return [_assignment_card(a, tutors.get(a.tutor_id)) for a in items]


@router.post("/me/assignments/{assignment_id}/complete", response_model=AssignmentCard)
def complete_assignment(
    assignment_id: int,
    done: bool = True,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    """Ученик отмечает задание выполненным (или снимает отметку через ?done=false)."""
    a = (
        db.query(TutorAssignment)
        .filter(TutorAssignment.id == assignment_id, TutorAssignment.student_id == current.id)
        .first()
    )
    if a is None:
        raise HTTPException(status_code=404, detail="Задание не найдено")
    a.status = "done" if done else "assigned"
    a.completed_at = datetime.utcnow() if done else None
    db.commit()
    db.refresh(a)
    tutor = db.query(User).filter(User.id == a.tutor_id).first()
    return _assignment_card(a, tutor)


@router.get("/me/sessions", response_model=List[SessionCard])
def my_sessions(db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    """Ближайшие занятия ученика со всеми его репетиторами (по времени)."""
    items = (
        db.query(TutorSession)
        .filter(TutorSession.student_id == current.id, TutorSession.status == "scheduled")
        .order_by(TutorSession.starts_at.asc())
        .all()
    )
    tutors = {u.id: u for u in db.query(User).filter(
        User.id.in_([s.tutor_id for s in items] or [0])
    ).all()}
    return [_session_card(s, tutor=tutors.get(s.tutor_id)) for s in items]


# --- Профиль конкретного репетитора + подключение (generic-роуты в конце) ---

@router.get("/tutors/{tutor_user_id}", response_model=TutorCard)
def get_tutor(tutor_user_id: int, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    prof = db.query(TutorProfile).filter(TutorProfile.user_id == tutor_user_id).first()
    if prof is None:
        raise HTTPException(status_code=404, detail="Репетитор не найден")
    return _card(db, prof, current.id)


@router.post("/tutors/{tutor_user_id}/connect", response_model=TutorCard)
def connect_to_tutor(
    tutor_user_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    """Ученик отправляет заявку репетитору (создаёт связь со статусом pending)."""
    if tutor_user_id == current.id:
        raise HTTPException(status_code=400, detail="Нельзя подключиться к самому себе")
    prof = db.query(TutorProfile).filter(TutorProfile.user_id == tutor_user_id).first()
    if prof is None:
        raise HTTPException(status_code=404, detail="Репетитор не найден")

    existing = (
        db.query(TutorStudent)
        .filter(TutorStudent.tutor_id == tutor_user_id, TutorStudent.student_id == current.id)
        .first()
    )
    if existing is None:
        db.add(TutorStudent(tutor_id=tutor_user_id, student_id=current.id, status="pending"))
        db.commit()
    return _card(db, prof, current.id)
