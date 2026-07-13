from app.services import ai_quota


def test_get_or_create_quota_creates_with_default_limit(client, db, content_manager_admin):
    quota = ai_quota.get_or_create_quota(db, content_manager_admin.id)
    assert quota.monthly_limit == ai_quota.DEFAULT_MONTHLY_LIMIT
    assert quota.used == 0
    assert quota.period == ai_quota._current_period()


def test_check_and_consume_within_limit(client, db, content_manager_admin):
    ai_quota.set_limit(db, content_manager_admin.id, 10)
    quota = ai_quota.check_and_consume(db, content_manager_admin.id, 3)
    assert quota.used == 3

    quota = ai_quota.check_and_consume(db, content_manager_admin.id, 5)
    assert quota.used == 8


def test_check_and_consume_exceeds_limit_raises(client, db, content_manager_admin):
    ai_quota.set_limit(db, content_manager_admin.id, 5)
    ai_quota.check_and_consume(db, content_manager_admin.id, 5)

    try:
        ai_quota.check_and_consume(db, content_manager_admin.id, 1)
        assert False, "expected ValueError"
    except ValueError as e:
        assert str(e) == "quota_exceeded"


def test_exceeded_check_does_not_partially_consume(client, db, content_manager_admin):
    ai_quota.set_limit(db, content_manager_admin.id, 5)
    ai_quota.check_and_consume(db, content_manager_admin.id, 3)

    try:
        ai_quota.check_and_consume(db, content_manager_admin.id, 10)
    except ValueError:
        pass

    from app.models import AIQuota

    quota = db.query(AIQuota).filter(AIQuota.admin_id == content_manager_admin.id).one()
    assert quota.used == 3  # неудачная попытка на 10 не списалась


def test_set_limit_creates_quota_if_missing(client, db, content_manager_admin):
    quota = ai_quota.set_limit(db, content_manager_admin.id, 100)
    assert quota.monthly_limit == 100


def test_period_reset_zeroes_used(client, db, content_manager_admin):
    from app.models import AIQuota

    ai_quota.set_limit(db, content_manager_admin.id, 10)
    ai_quota.check_and_consume(db, content_manager_admin.id, 7)

    # Симулируем "прошлый месяц" — следующее обращение должно сбросить used
    quota = db.query(AIQuota).filter(AIQuota.admin_id == content_manager_admin.id).one()
    quota.period = "2000-01"
    db.commit()

    refreshed = ai_quota.get_or_create_quota(db, content_manager_admin.id)
    assert refreshed.used == 0
    assert refreshed.period == ai_quota._current_period()
