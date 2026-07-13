"""
Golden-тесты алгоритма пересчёта mastery (R2 task 2). Любое изменение
порогов в app/services/mastery.py должно быть видно здесь одним диффом —
см. комментарий в самом сервисе.
"""
from datetime import datetime, timedelta

from app.services import mastery


def _make_task(db, subject, estimated_time_seconds=60):
    from app.models import Task

    task = Task(
        title="t", subject=subject.code, subject_id=subject.id,
        status="published", estimated_time_seconds=estimated_time_seconds,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def _add_attempt(db, user, skill, task, is_correct, time_spent_ms=None, hints_used=0, when=None):
    from app.models import Attempt

    a = Attempt(
        user_id=user.id,
        content_type="task",
        content_id=task.id,
        skill_id=skill["id"],
        is_correct=is_correct,
        time_spent_ms=time_spent_ms,
        hints_used=hints_used,
        created_at=when or datetime.utcnow(),
    )
    db.add(a)
    db.commit()
    return a


def _make_skill(db, subject):
    from app.models import Skill

    skill = Skill(subject_id=subject.id, name="s", code="skill-x")
    db.add(skill)
    db.commit()
    db.refresh(skill)
    return {"id": skill.id}


def test_no_attempts_returns_none(client, db, user, subject):
    skill = _make_skill(db, subject)
    result = mastery.recompute(db, user.id, skill["id"])
    assert result is None


def test_high_accuracy_fast_no_hints_gives_advanced(client, db, user, subject):
    skill = _make_skill(db, subject)
    task = _make_task(db, subject, estimated_time_seconds=100)
    for _ in range(10):
        _add_attempt(db, user, skill, task, is_correct=True, time_spent_ms=50_000)  # 0.5x estimated

    state = mastery.recompute(db, user.id, skill["id"])
    assert state.level == "advanced"
    assert state.confidence == 100
    assert state.factors["accuracy"] == 1.0


def test_low_accuracy_gives_basic(client, db, user, subject):
    skill = _make_skill(db, subject)
    task = _make_task(db, subject)
    for i in range(10):
        _add_attempt(db, user, skill, task, is_correct=(i < 3))  # 30% accuracy

    state = mastery.recompute(db, user.id, skill["id"])
    assert state.level == "basic"


def test_mixed_accuracy_normal_speed_gives_standard(client, db, user, subject):
    skill = _make_skill(db, subject)
    task = _make_task(db, subject, estimated_time_seconds=100)
    for i in range(10):
        _add_attempt(db, user, skill, task, is_correct=(i < 7), time_spent_ms=100_000)  # 70%, 1.0x time

    state = mastery.recompute(db, user.id, skill["id"])
    assert state.level == "standard"


def test_high_hints_rate_forces_basic_despite_good_accuracy(client, db, user, subject):
    skill = _make_skill(db, subject)
    task = _make_task(db, subject, estimated_time_seconds=100)
    for _ in range(10):
        # 100% accuracy, fast — would be "advanced" without heavy hint use
        _add_attempt(db, user, skill, task, is_correct=True, time_spent_ms=50_000, hints_used=2)

    state = mastery.recompute(db, user.id, skill["id"])
    assert state.level == "basic"
    assert state.factors["hints_rate"] == 1.0


def test_slow_solving_forces_basic_despite_good_accuracy(client, db, user, subject):
    skill = _make_skill(db, subject)
    task = _make_task(db, subject, estimated_time_seconds=60)
    for _ in range(10):
        # 100% accuracy but takes 2x the estimated time every time
        _add_attempt(db, user, skill, task, is_correct=True, time_spent_ms=120_000)

    state = mastery.recompute(db, user.id, skill["id"])
    assert state.level == "basic"


def test_confidence_scales_with_sample_size(client, db, user, subject):
    skill = _make_skill(db, subject)
    task = _make_task(db, subject)

    _add_attempt(db, user, skill, task, is_correct=True)
    state = mastery.recompute(db, user.id, skill["id"])
    assert state.sample_size == 1
    assert state.confidence == 10  # 1/10 * 100

    for _ in range(9):
        _add_attempt(db, user, skill, task, is_correct=True)
    state = mastery.recompute(db, user.id, skill["id"])
    assert state.sample_size == 10
    assert state.confidence == 100


def test_confidence_caps_at_100_beyond_full_sample(client, db, user, subject):
    skill = _make_skill(db, subject)
    task = _make_task(db, subject)
    for _ in range(15):
        _add_attempt(db, user, skill, task, is_correct=True)

    state = mastery.recompute(db, user.id, skill["id"])
    # окно — последние 10 попыток, не все 15
    assert state.sample_size == 10
    assert state.confidence == 100


def test_window_only_considers_last_10_attempts(client, db, user, subject):
    skill = _make_skill(db, subject)
    task = _make_task(db, subject)
    base = datetime(2026, 1, 1, 12, 0, 0)

    # 5 старых провальных попыток...
    for i in range(5):
        _add_attempt(db, user, skill, task, is_correct=False, when=base + timedelta(minutes=i))
    # ...затем 10 новых верных — окно должно видеть только их
    for i in range(10):
        _add_attempt(db, user, skill, task, is_correct=True, when=base + timedelta(hours=1, minutes=i))

    state = mastery.recompute(db, user.id, skill["id"])
    assert state.sample_size == 10
    assert state.factors["accuracy"] == 1.0
    assert state.level == "advanced"  # старые провалы вне окна не тянут вниз


def test_missing_timing_data_still_computes_level(client, db, user, subject):
    skill = _make_skill(db, subject)
    task = _make_task(db, subject)
    for _ in range(10):
        _add_attempt(db, user, skill, task, is_correct=True, time_spent_ms=None)

    state = mastery.recompute(db, user.id, skill["id"])
    assert state.level == "advanced"
    assert state.factors["avg_time_ratio"] is None


def test_recompute_upserts_single_row_per_user_skill(client, db, user, subject):
    from app.models import MasteryState

    skill = _make_skill(db, subject)
    task = _make_task(db, subject)
    _add_attempt(db, user, skill, task, is_correct=True)
    mastery.recompute(db, user.id, skill["id"])
    _add_attempt(db, user, skill, task, is_correct=False)
    mastery.recompute(db, user.id, skill["id"])

    rows = db.query(MasteryState).filter(
        MasteryState.user_id == user.id, MasteryState.skill_id == skill["id"]
    ).all()
    assert len(rows) == 1
    assert rows[0].sample_size == 2


# --- level_override (R2 task 4) ---

def test_is_adjacent_level_basic_standard():
    assert mastery.is_adjacent_level("basic", "standard") is True
    assert mastery.is_adjacent_level("standard", "basic") is True


def test_is_adjacent_level_standard_advanced():
    assert mastery.is_adjacent_level("standard", "advanced") is True


def test_is_adjacent_level_basic_advanced_not_adjacent():
    assert mastery.is_adjacent_level("basic", "advanced") is False


def test_set_override_requires_existing_mastery_state(client, db, user, subject):
    skill = _make_skill(db, subject)
    try:
        mastery.set_override(db, user.id, skill["id"], "standard")
        assert False, "expected ValueError"
    except ValueError as e:
        assert str(e) == "no_mastery_state"


def test_set_override_rejects_non_adjacent_level(client, db, user, subject):
    skill = _make_skill(db, subject)
    task = _make_task(db, subject)
    for _ in range(10):
        _add_attempt(db, user, skill, task, is_correct=False)  # -> basic
    mastery.recompute(db, user.id, skill["id"])

    try:
        mastery.set_override(db, user.id, skill["id"], "advanced")  # basic->advanced не сосед
        assert False, "expected ValueError"
    except ValueError as e:
        assert str(e) == "not_adjacent"


def test_set_override_accepts_adjacent_level(client, db, user, subject):
    from app.models import LevelOverride

    skill = _make_skill(db, subject)
    task = _make_task(db, subject)
    for _ in range(10):
        _add_attempt(db, user, skill, task, is_correct=False)  # -> basic
    mastery.recompute(db, user.id, skill["id"])

    override = mastery.set_override(db, user.id, skill["id"], "standard")
    assert override.chosen_level == "standard"
    assert override.expires_at > datetime.utcnow()

    rows = db.query(LevelOverride).filter(
        LevelOverride.user_id == user.id, LevelOverride.skill_id == skill["id"]
    ).all()
    assert len(rows) == 1


def test_set_override_upserts_not_duplicates(client, db, user, subject):
    from app.models import LevelOverride

    skill = _make_skill(db, subject)
    task = _make_task(db, subject)
    for _ in range(10):
        _add_attempt(db, user, skill, task, is_correct=True)  # -> advanced
    mastery.recompute(db, user.id, skill["id"])

    mastery.set_override(db, user.id, skill["id"], "standard")
    mastery.set_override(db, user.id, skill["id"], "standard")

    rows = db.query(LevelOverride).filter(
        LevelOverride.user_id == user.id, LevelOverride.skill_id == skill["id"]
    ).all()
    assert len(rows) == 1


def test_clear_override_removes_row(client, db, user, subject):
    from app.models import LevelOverride

    skill = _make_skill(db, subject)
    task = _make_task(db, subject)
    for _ in range(10):
        _add_attempt(db, user, skill, task, is_correct=True)
    mastery.recompute(db, user.id, skill["id"])
    mastery.set_override(db, user.id, skill["id"], "standard")

    mastery.clear_override(db, user.id, skill["id"])

    assert db.query(LevelOverride).filter(
        LevelOverride.user_id == user.id, LevelOverride.skill_id == skill["id"]
    ).count() == 0


def test_get_active_override_ignores_expired(client, db, user, subject):
    from app.models import LevelOverride

    skill = _make_skill(db, subject)
    expired = LevelOverride(
        user_id=user.id, skill_id=skill["id"], chosen_level="standard",
        expires_at=datetime.utcnow() - timedelta(days=1),
    )
    db.add(expired)
    db.commit()

    assert mastery.get_active_override(db, user.id, skill["id"]) is None
