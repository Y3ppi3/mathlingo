"""
Golden-тесты записи игровых попыток (R3 task 6) — одна запись в attempts на
сессию (не на каждый внутриигровой ответ) + пересчёт mastery только когда у
сценария указана тема. См. app/services/game_attempts.py.
"""
from app.models import Attempt, GameScenario, MasteryState, Skill
from app.services import game_attempts


def _make_scenario(db, skill_id=None):
    scenario = GameScenario(
        template_key="derivfall",
        config={"template_key": "derivfall", "difficulty": 3, "time_limit": 60, "problems": []},
        status="published",
        skill_id=skill_id,
    )
    db.add(scenario)
    db.commit()
    db.refresh(scenario)
    return scenario


def _make_skill(db, subject):
    skill = Skill(subject_id=subject.id, name="s", code="skill-x")
    db.add(skill)
    db.commit()
    db.refresh(skill)
    return skill


def test_records_single_attempt_row_per_session(client, db, user):
    scenario = _make_scenario(db)
    game_attempts.record_attempt(db, user.id, scenario, score=80, max_score=100, time_spent_ms=12345)

    rows = db.query(Attempt).filter(Attempt.user_id == user.id, Attempt.content_type == "game").all()
    assert len(rows) == 1
    assert rows[0].content_id == scenario.id
    assert rows[0].source == "game"
    assert rows[0].time_spent_ms == 12345
    assert rows[0].hints_used == 0


def test_pass_threshold_boundary(client, db, user):
    scenario = _make_scenario(db)

    below = game_attempts.record_attempt(db, user.id, scenario, score=49, max_score=100)
    assert below.is_correct is False

    at_threshold = game_attempts.record_attempt(db, user.id, scenario, score=50, max_score=100)
    assert at_threshold.is_correct is True


def test_zero_max_score_is_not_correct(client, db, user):
    scenario = _make_scenario(db)
    attempt = game_attempts.record_attempt(db, user.id, scenario, score=0, max_score=0)
    assert attempt.is_correct is False


def test_score_clamped_to_max_score_range(client, db, user):
    scenario = _make_scenario(db)
    # Отрицательный score и score > max_score не должны ронять сервис —
    # клиент (игровой компонент) им не доверяем полностью.
    attempt = game_attempts.record_attempt(db, user.id, scenario, score=-5, max_score=100)
    assert attempt.is_correct is False
    attempt2 = game_attempts.record_attempt(db, user.id, scenario, score=1000, max_score=100)
    assert attempt2.is_correct is True


def test_no_skill_id_skips_mastery_recompute(client, db, user):
    scenario = _make_scenario(db, skill_id=None)
    game_attempts.record_attempt(db, user.id, scenario, score=100, max_score=100)

    assert db.query(MasteryState).filter(MasteryState.user_id == user.id).count() == 0


def test_skill_id_triggers_mastery_recompute(client, db, user, subject):
    skill = _make_skill(db, subject)
    scenario = _make_scenario(db, skill_id=skill.id)
    game_attempts.record_attempt(db, user.id, scenario, score=100, max_score=100)

    state = db.query(MasteryState).filter(MasteryState.user_id == user.id, MasteryState.skill_id == skill.id).first()
    assert state is not None
    assert state.sample_size == 1
