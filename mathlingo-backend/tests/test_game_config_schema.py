"""
Golden-тесты GameConfigSchema (R3 task 2) — по одной под-схеме на каждый из
трёх игровых шаблонов (см. app/services/game_config.py, форма скопирована
1:1 с текущих React-пропсов DerivFall/IntegralBuilder/MathLab по итогам
аудита R3 задачи 1). Любое изменение контракта должно быть видно здесь
одним диффом.
"""
import pytest

from app.services import game_config


def test_unknown_template_key_rejected():
    with pytest.raises(ValueError, match="Неизвестный template_key"):
        game_config.validate_config("not-a-template", {})


# --- derivfall ---

def _valid_derivfall_config():
    return {
        "difficulty": 3,
        "time_limit": 60,
        "problems": [
            {"id": "d1", "problem": "(x^2)'", "options": ["2x", "x", "2", "x^2"], "answer": "2x", "difficulty": "easy"},
        ],
    }


def test_derivfall_valid_config_passes():
    result = game_config.validate_config("derivfall", _valid_derivfall_config())
    assert result["template_key"] == "derivfall"
    assert result["problems"][0]["answer"] == "2x"


def test_derivfall_answer_not_in_options_rejected():
    config = _valid_derivfall_config()
    config["problems"][0]["answer"] = "not-an-option"
    with pytest.raises(ValueError):
        game_config.validate_config("derivfall", config)


def test_derivfall_requires_at_least_one_problem():
    config = _valid_derivfall_config()
    config["problems"] = []
    with pytest.raises(ValueError):
        game_config.validate_config("derivfall", config)


def test_derivfall_difficulty_out_of_range_rejected():
    config = _valid_derivfall_config()
    config["difficulty"] = 9
    with pytest.raises(ValueError):
        game_config.validate_config("derivfall", config)


def test_derivfall_applies_defaults():
    config = {"problems": _valid_derivfall_config()["problems"]}
    result = game_config.validate_config("derivfall", config)
    assert result["difficulty"] == 3
    assert result["time_limit"] == 60


# --- integralbuilder ---

def _valid_integralbuilder_config():
    return {
        "initial_difficulty": 3,
        "time_limit": 300,
        "problems": [
            {"id": "i1", "question": "∫ x² dx", "solution_pieces": ["x³/3", "+C"], "distractors": ["x²/2"], "difficulty": "easy"},
        ],
    }


def test_integralbuilder_valid_config_passes():
    result = game_config.validate_config("integralbuilder", _valid_integralbuilder_config())
    assert result["template_key"] == "integralbuilder"
    assert result["problems"][0]["solution_pieces"] == ["x³/3", "+C"]


def test_integralbuilder_requires_at_least_one_solution_piece():
    config = _valid_integralbuilder_config()
    config["problems"][0]["solution_pieces"] = []
    with pytest.raises(ValueError):
        game_config.validate_config("integralbuilder", config)


def test_integralbuilder_distractors_optional():
    config = _valid_integralbuilder_config()
    del config["problems"][0]["distractors"]
    result = game_config.validate_config("integralbuilder", config)
    assert result["problems"][0]["distractors"] == []


# --- mathlab (только вкладка "Задачи" — "Графики" вне scope конструктора) ---

def _valid_mathlab_config():
    return {
        "mode": "derivatives",
        "difficulty": 3,
        "tasks": [
            {
                "id": "t1", "type": "calculate", "question": "Найдите производную x^2",
                "function_expression": "x^2", "correct_answer": "2x", "difficulty": 3,
                "hints": ["Используйте правило степени"],
            },
        ],
    }


def test_mathlab_valid_config_passes():
    result = game_config.validate_config("mathlab", _valid_mathlab_config())
    assert result["template_key"] == "mathlab"
    assert result["mode"] == "derivatives"


def test_mathlab_requires_mode():
    config = _valid_mathlab_config()
    del config["mode"]
    with pytest.raises(ValueError):
        game_config.validate_config("mathlab", config)


def test_mathlab_invalid_task_type_rejected():
    config = _valid_mathlab_config()
    config["tasks"][0]["type"] = "not-a-type"
    with pytest.raises(ValueError):
        game_config.validate_config("mathlab", config)


def test_mathlab_hints_default_to_empty_list():
    config = _valid_mathlab_config()
    del config["tasks"][0]["hints"]
    result = game_config.validate_config("mathlab", config)
    assert result["tasks"][0]["hints"] == []


# --- mathlab mode="limits" ("Приближение", R4) ---

def _valid_limits_config():
    return {
        "mode": "limits",
        "difficulty": 3,
        "tasks": [
            {
                "id": "l1", "type": "limit", "question": "Чему равен предел?",
                "function_expression": "(x^2-4)/(x-2)", "approach_x": "2",
                "correct_answer": "4", "options": ["2", "4", "не существует", "∞"],
                "difficulty": 3, "hints": [],
            },
        ],
    }


def test_limits_valid_config_passes():
    result = game_config.validate_config("mathlab", _valid_limits_config())
    assert result["mode"] == "limits"
    assert result["tasks"][0]["approach_x"] == "2"


def test_limits_requires_approach_x():
    config = _valid_limits_config()
    config["tasks"][0]["approach_x"] = None
    with pytest.raises(ValueError, match="approach_x обязателен"):
        game_config.validate_config("mathlab", config)


def test_limits_requires_options():
    config = _valid_limits_config()
    config["tasks"][0]["options"] = None
    with pytest.raises(ValueError, match="options обязательны"):
        game_config.validate_config("mathlab", config)


def test_limits_requires_type_limit():
    config = _valid_limits_config()
    config["tasks"][0]["type"] = "calculate"
    with pytest.raises(ValueError, match="type должен быть 'limit'"):
        game_config.validate_config("mathlab", config)


def test_limits_correct_answer_not_in_options_rejected():
    config = _valid_limits_config()
    config["tasks"][0]["correct_answer"] = "not-an-option"
    with pytest.raises(ValueError, match="correct_answer must be one of options"):
        game_config.validate_config("mathlab", config)


def test_derivatives_mode_does_not_require_approach_x():
    # derivatives/integrals не должны внезапно требовать approach_x —
    # проверка ограничена mode="limits" (см. game_config.py).
    result = game_config.validate_config("mathlab", _valid_mathlab_config())
    assert result["tasks"][0]["approach_x"] is None


# --- mathlab mode="series" ("Наполнение", R4) ---

def _valid_series_config():
    return {
        "mode": "series",
        "difficulty": 3,
        "tasks": [
            {
                "id": "s1", "type": "series", "question": "К чему стремится сумма ряда?",
                "function_expression": "1/2^n",
                "correct_answer": "1", "options": ["1", "2", "расходится", "0"],
                "difficulty": 3, "hints": [],
            },
        ],
    }


def test_series_valid_config_passes():
    result = game_config.validate_config("mathlab", _valid_series_config())
    assert result["mode"] == "series"
    assert result["tasks"][0]["function_expression"] == "1/2^n"


def test_series_requires_type_series():
    config = _valid_series_config()
    config["tasks"][0]["type"] = "limit"
    with pytest.raises(ValueError, match="type должен быть 'series'"):
        game_config.validate_config("mathlab", config)


def test_series_requires_options():
    config = _valid_series_config()
    config["tasks"][0]["options"] = None
    with pytest.raises(ValueError, match="options обязательны"):
        game_config.validate_config("mathlab", config)


def test_series_correct_answer_not_in_options_rejected():
    config = _valid_series_config()
    config["tasks"][0]["correct_answer"] = "not-an-option"
    with pytest.raises(ValueError, match="correct_answer must be one of options"):
        game_config.validate_config("mathlab", config)


def test_series_does_not_require_approach_x():
    result = game_config.validate_config("mathlab", _valid_series_config())
    assert result["tasks"][0]["approach_x"] is None
