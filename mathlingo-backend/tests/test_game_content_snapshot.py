"""
R3 task 8: snapshot-регрессия по контенту трёх мигрированных игр.

"До" миграции на конфиг данные жили только как хардкод внутри React-
компонентов (DerivFall.tsx DEFAULT_PROBLEMS, IntegralBuilder.tsx инлайн-
массив, utils/gameDataSource.ts) — весь этот код уже удалён (R3 задачи 3-4),
поэтому буквальный "diff до/после" по коду невозможен постфактум. Вместо
этого замораживаем хэш данных, перенесённых в бэкафилл-миграции
(alembic/versions/8bed744e646f_..., c6354c45add1_...), на момент, когда они
последний раз были 1:1 сверены построчно с исходным хардкодом (см. историю
задач 3-4). Любая последующая случайная правка этих констант — забытый
символ, потерянная задача, сломанный LaTeX — меняет хэш и роняет тест,
что и есть цель snapshot-регрессии, даже без сохранённого "до"-снепшота.

Дополнительно проверяем, что данные всё ещё проходят GameConfigSchema —
это ловит несовместимые изменения самой схемы (app/services/game_config.py),
а не только контента.
"""
import hashlib
import importlib.util
import json
import os

import pytest

from app.services import game_config

BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _load_migration(filename, module_name):
    path = os.path.join(BACKEND_ROOT, "alembic", "versions", filename)
    spec = importlib.util.spec_from_file_location(module_name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _content_hash(obj) -> str:
    return hashlib.sha256(json.dumps(obj, sort_keys=True, ensure_ascii=False).encode("utf-8")).hexdigest()


derivfall_migration = _load_migration("8bed744e646f_backfill_derivfall_game_scenario.py", "backfill_derivfall")
mathlab_migration = _load_migration("c6354c45add1_backfill_integralbuilder_and_mathlab_.py", "backfill_integralbuilder_mathlab")

# Заморожено при переносе задач 3-4 (см. docstring выше) — не менять вручную,
# кроме как вместе с осознанным пересмотром контента игр.
EXPECTED_SNAPSHOTS = {
    "derivfall": {
        "count": 14,
        "hash": "9bd74f44bd2cd2149c5f61d53a3951dcd04ee3ac253cc93a263ee30f8332a4cd",
    },
    "integralbuilder": {
        "count": 8,
        "hash": "ee53c3e4243d79c8e847dd36a2a1c8a14c1f5b5f25b7dca722d9182343c87315",
    },
    "mathlab_derivatives": {
        "count": 12,
        "hash": "426cada608b3621f517ade4c0fedc9a0a45e1ace79e91fbba32c3d0e493070f9",
    },
    "mathlab_integrals": {
        "count": 12,
        "hash": "17045b416cf1aa031d45fbb13b3d8fe241e9b838bac6fcce985eda847f921107",
    },
}


@pytest.mark.parametrize("key,data", [
    ("derivfall", derivfall_migration.DERIVFALL_PROBLEMS),
    ("integralbuilder", mathlab_migration.INTEGRALBUILDER_PROBLEMS),
    ("mathlab_derivatives", mathlab_migration.MATHLAB_DERIVATIVE_TASKS),
    ("mathlab_integrals", mathlab_migration.MATHLAB_INTEGRAL_TASKS),
])
def test_backfill_content_matches_frozen_snapshot(key, data):
    expected = EXPECTED_SNAPSHOTS[key]
    assert len(data) == expected["count"], f"{key}: количество задач изменилось — обновите снепшот осознанно"
    assert _content_hash(data) == expected["hash"], f"{key}: содержимое задач изменилось — обновите снепшот осознанно"


def test_derivfall_backfill_still_matches_schema():
    config = game_config.validate_config("derivfall", {
        "difficulty": 3, "time_limit": 60, "problems": derivfall_migration.DERIVFALL_PROBLEMS,
    })
    assert len(config["problems"]) == 14


def test_integralbuilder_backfill_still_matches_schema():
    config = game_config.validate_config("integralbuilder", {
        "initial_difficulty": 3, "time_limit": 300, "problems": mathlab_migration.INTEGRALBUILDER_PROBLEMS,
    })
    assert len(config["problems"]) == 8


def test_mathlab_derivatives_backfill_still_matches_schema():
    config = game_config.validate_config("mathlab", {
        "mode": "derivatives", "difficulty": 3, "tasks": mathlab_migration.MATHLAB_DERIVATIVE_TASKS,
    })
    assert len(config["tasks"]) == 12


def test_mathlab_integrals_backfill_still_matches_schema():
    config = game_config.validate_config("mathlab", {
        "mode": "integrals", "difficulty": 4, "tasks": mathlab_migration.MATHLAB_INTEGRAL_TASKS,
    })
    assert len(config["tasks"]) == 12
