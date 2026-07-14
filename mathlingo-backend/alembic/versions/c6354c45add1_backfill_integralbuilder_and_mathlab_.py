"""backfill_integralbuilder_and_mathlab_scenarios

Revision ID: c6354c45add1
Revises: 8bed744e646f
Create Date: 2026-07-14 10:37:22.406594

"""
from datetime import datetime
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c6354c45add1'
down_revision: Union[str, None] = '8bed744e646f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# R3 task 4: IntegralBuilder.tsx и MathLab.tsx перестают содержать свои
# собственные захардкоженные наборы заданий (инлайн-массив в
# IntegralBuilder.tsx и MockGameDataSource в utils/gameDataSource.ts) и
# полностью переходят на конфиг из game_scenarios — без этой записи обе игры
# "пропадут" сразу после деплоя. Данные — 1:1 копия удаляемых массивов на
# момент миграции.
INTEGRALBUILDER_PROBLEMS = [
    {"id": "i1", "question": "∫ x² dx", "solution_pieces": ["x³/3", "+C"], "distractors": ["x²/2", "3x²", "x³", "2x"], "difficulty": "easy"},
    {"id": "i2", "question": "∫ 3x² dx", "solution_pieces": ["x³", "+C"], "distractors": ["3x³/3", "3x²/2", "3x", "6x"], "difficulty": "easy"},
    {"id": "i3", "question": "∫ sin 2x dx", "solution_pieces": ["-", "cos 2x/2", "+C"], "distractors": ["sin 2x/2", "2 sin x", "cos x", "sin x²"], "difficulty": "medium"},
    {"id": "i4", "question": "∫ 1/x² dx", "solution_pieces": ["-", "1/x", "+C"], "distractors": ["ln|x|", "x⁻¹", "1/2x²", "-x⁻²"], "difficulty": "medium"},
    {"id": "i5", "question": "∫ e^x dx", "solution_pieces": ["e^x", "+C"], "distractors": ["xe^x", "e^x/x", "ln(e^x)"], "difficulty": "easy"},
    {"id": "i6", "question": "∫ 1/x dx", "solution_pieces": ["ln|x|", "+C"], "distractors": ["1/x²", "x⁻¹", "1/2x²"], "difficulty": "medium"},
    {"id": "i7", "question": "∫ cos x dx", "solution_pieces": ["sin x", "+C"], "distractors": ["-cos x", "tan x", "sec x"], "difficulty": "easy"},
    {"id": "i8", "question": "∫ (3x² - 4x + 5) dx", "solution_pieces": ["x³", "-2x²", "+5x", "+C"], "distractors": ["3x³", "4x²", "-5x", "x²"], "difficulty": "hard"},
]

MATHLAB_DERIVATIVE_TASKS = [
    {"id": "d1", "type": "calculate", "question": "Найдите производную: y'(x) = x³", "function_expression": "x³", "correct_answer": "3x²", "options": ["3x²", "3x⁴", "4x³", "x²"], "difficulty": 3, "hints": ["Используйте правила дифференцирования", "Вспомните формулу производной степенной функции", "Применяйте правило дифференцирования по частям, если необходимо"]},
    {"id": "d2", "type": "calculate", "question": "Найдите производную: y'(x) = x⁷", "function_expression": "x⁷", "correct_answer": "7x⁶", "options": ["7x⁶", "6x⁵", "7x⁸", "x⁶"], "difficulty": 3, "hints": ["Используйте правила дифференцирования", "Вспомните формулу производной степенной функции", "Применяйте правило дифференцирования по частям, если необходимо"]},
    {"id": "d3", "type": "calculate", "question": "Найдите производную: y'(x) = x⁻²", "function_expression": "x⁻²", "correct_answer": "-2x⁻³", "options": ["-2x⁻³", "2/x³", "-2/x³", "-x⁻³"], "difficulty": 5, "hints": ["Используйте правила дифференцирования", "Вспомните формулу производной степенной функции", "Применяйте правило дифференцирования по частям, если необходимо"]},
    {"id": "d4", "type": "calculate", "question": "Найдите производную: y'(x) = √x", "function_expression": "√x", "correct_answer": "1/(2√x)", "options": ["1/(2√x)", "2√x", "1/2√x", "√x/2"], "difficulty": 5, "hints": ["Используйте правила дифференцирования", "Вспомните формулу производной степенной функции", "Применяйте правило дифференцирования по частям, если необходимо"]},
    {"id": "d5", "type": "calculate", "question": "Найдите производную: y'(x) = (5x+2)⁻³", "function_expression": "(5x+2)⁻³", "correct_answer": "-15(5x+2)⁻⁴", "options": ["-15(5x+2)⁻⁴", "-3(5x+2)⁻⁴", "-5(5x+2)⁻⁴", "-15(5x+2)⁻²"], "difficulty": 5, "hints": ["Используйте правила дифференцирования", "Вспомните формулу производной степенной функции", "Применяйте правило дифференцирования по частям, если необходимо"]},
    {"id": "d6", "type": "calculate", "question": "Найдите производную: y'(x) = sin(x)", "function_expression": "sin(x)", "correct_answer": "cos(x)", "options": ["cos(x)", "-sin(x)", "tan(x)", "sec²(x)"], "difficulty": 1, "hints": ["Используйте правила дифференцирования", "Вспомните формулу производной степенной функции", "Применяйте правило дифференцирования по частям, если необходимо"]},
    {"id": "d7", "type": "calculate", "question": "Найдите производную: y'(x) = e^x", "function_expression": "e^x", "correct_answer": "e^x", "options": ["e^x", "xe^x", "e^(x-1)", "ln(x)e^x"], "difficulty": 1, "hints": ["Используйте правила дифференцирования", "Вспомните формулу производной степенной функции", "Применяйте правило дифференцирования по частям, если необходимо"]},
    {"id": "d8", "type": "calculate", "question": "Найдите производную: y'(x) = ln(x)", "function_expression": "ln(x)", "correct_answer": "1/x", "options": ["1/x", "ln(x)/x", "x^(-1)", "1/ln(x)"], "difficulty": 3, "hints": ["Используйте правила дифференцирования", "Вспомните формулу производной степенной функции", "Применяйте правило дифференцирования по частям, если необходимо"]},
    {"id": "d9", "type": "calculate", "question": "Найдите производную: y'(x) = cos(x)", "function_expression": "cos(x)", "correct_answer": "-sin(x)", "options": ["-sin(x)", "sin(x)", "-cos(x)", "tan(x)"], "difficulty": 1, "hints": ["Используйте правила дифференцирования", "Вспомните формулу производной степенной функции", "Применяйте правило дифференцирования по частям, если необходимо"]},
    {"id": "d10", "type": "calculate", "question": "Найдите производную: y'(x) = tan(x)", "function_expression": "tan(x)", "correct_answer": "sec²(x)", "options": ["sec²(x)", "-csc²(x)", "1/cos²(x)", "sin(x)/cos²(x)"], "difficulty": 3, "hints": ["Используйте правила дифференцирования", "Вспомните формулу производной степенной функции", "Применяйте правило дифференцирования по частям, если необходимо"]},
    {"id": "d11", "type": "calculate", "question": "Найдите производную: y'(x) = x² + 3x", "function_expression": "x² + 3x", "correct_answer": "2x + 3", "options": ["2x + 3", "2x² + 3", "x + 3", "2x + 3x²"], "difficulty": 1, "hints": ["Используйте правила дифференцирования", "Вспомните формулу производной степенной функции", "Применяйте правило дифференцирования по частям, если необходимо"]},
    {"id": "d12", "type": "calculate", "question": "Найдите производную: y'(x) = x·sin(x)", "function_expression": "x·sin(x)", "correct_answer": "sin(x) + x·cos(x)", "options": ["sin(x) + x·cos(x)", "x·cos(x)", "sin(x) - x·cos(x)", "cos(x) + x·sin(x)"], "difficulty": 3, "hints": ["Используйте правила дифференцирования", "Вспомните формулу производной степенной функции", "Применяйте правило дифференцирования по частям, если необходимо"]},
]

MATHLAB_INTEGRAL_TASKS = [
    {"id": "i1", "type": "find", "question": "Вычислите интеграл: ∫ x² dx", "function_expression": "x²", "correct_answer": "x³/3+C", "options": ["x³/3", "+C", "x²/2", "3x²"], "difficulty": 1, "hints": ["Найдите первообразную функции", "Вспомните формулы интегрирования", "Не забудьте про константу интегрирования"]},
    {"id": "i2", "type": "find", "question": "Вычислите интеграл: ∫ 3x² dx", "function_expression": "3x²", "correct_answer": "x³+C", "options": ["x³", "+C", "3x³/3", "3x²/2"], "difficulty": 1, "hints": ["Найдите первообразную функции", "Вспомните формулы интегрирования", "Не забудьте про константу интегрирования"]},
    {"id": "i3", "type": "find", "question": "Вычислите интеграл: ∫ sin 2x dx", "function_expression": "sin 2x", "correct_answer": "-cos 2x/2+C", "options": ["-", "cos 2x/2", "+C", "sin 2x/2"], "difficulty": 3, "hints": ["Найдите первообразную функции", "Вспомните формулы интегрирования", "Не забудьте про константу интегрирования"]},
    {"id": "i4", "type": "find", "question": "Вычислите интеграл: ∫ 1/x² dx", "function_expression": "1/x²", "correct_answer": "-1/x+C", "options": ["-", "1/x", "+C", "ln|x|"], "difficulty": 3, "hints": ["Найдите первообразную функции", "Вспомните формулы интегрирования", "Не забудьте про константу интегрирования"]},
    {"id": "i5", "type": "find", "question": "Вычислите интеграл: ∫ e^x dx", "function_expression": "e^x", "correct_answer": "e^x+C", "options": ["e^x", "+C", "xe^x", "e^x/x"], "difficulty": 1, "hints": ["Найдите первообразную функции", "Вспомните формулы интегрирования", "Не забудьте про константу интегрирования"]},
    {"id": "i6", "type": "find", "question": "Вычислите интеграл: ∫ 1/x dx", "function_expression": "1/x", "correct_answer": "ln|x|+C", "options": ["ln|x|", "+C", "1/x²", "x⁻¹"], "difficulty": 3, "hints": ["Найдите первообразную функции", "Вспомните формулы интегрирования", "Не забудьте про константу интегрирования"]},
    {"id": "i7", "type": "find", "question": "Вычислите интеграл: ∫ cos x dx", "function_expression": "cos x", "correct_answer": "sin x+C", "options": ["sin x", "+C", "-cos x", "tan x"], "difficulty": 1, "hints": ["Найдите первообразную функции", "Вспомните формулы интегрирования", "Не забудьте про константу интегрирования"]},
    {"id": "i8", "type": "find", "question": "Вычислите интеграл: ∫ (3x² - 4x + 5) dx", "function_expression": "(3x² - 4x + 5)", "correct_answer": "x³-2x²+5x+C", "options": ["x³", "-2x²", "+5x", "+C"], "difficulty": 5, "hints": ["Найдите первообразную функции", "Вспомните формулы интегрирования", "Не забудьте про константу интегрирования"]},
    {"id": "i9", "type": "find", "question": "Вычислите интеграл: ∫ x·e^x dx", "function_expression": "x·e^x", "correct_answer": "x·e^x-e^x+C", "options": ["x·e^x", "-e^x", "+C", "e^x"], "difficulty": 5, "hints": ["Найдите первообразную функции", "Вспомните формулы интегрирования", "Не забудьте про константу интегрирования"]},
    {"id": "i10", "type": "find", "question": "Вычислите интеграл: ∫ tan x dx", "function_expression": "tan x", "correct_answer": "-ln|cos x|+C", "options": ["-ln|cos x|", "+C", "ln|sin x|", "ln|tan x|"], "difficulty": 5, "hints": ["Найдите первообразную функции", "Вспомните формулы интегрирования", "Не забудьте про константу интегрирования"]},
    {"id": "i11", "type": "find", "question": "Вычислите интеграл: ∫ x·sin x dx", "function_expression": "x·sin x", "correct_answer": "-x·cos x+sin x+C", "options": ["-x·cos x", "+sin x", "+C", "x·sin x"], "difficulty": 5, "hints": ["Найдите первообразную функции", "Вспомните формулы интегрирования", "Не забудьте про константу интегрирования"]},
    {"id": "i12", "type": "find", "question": "Вычислите интеграл: ∫ √x dx", "function_expression": "√x", "correct_answer": "2x^(3/2)/3+C", "options": ["2x^(3/2)/3", "+C", "x^(3/2)/3", "2√x"], "difficulty": 3, "hints": ["Найдите первообразную функции", "Вспомните формулы интегрирования", "Не забудьте про константу интегрирования"]},
]

game_scenarios_table = sa.table(
    "game_scenarios",
    sa.column("template_key", sa.String),
    sa.column("config", sa.JSON),
    sa.column("status", sa.String),
    sa.column("created_by_admin_id", sa.Integer),
    sa.column("published_at", sa.DateTime),
    sa.column("created_at", sa.DateTime),
)


def upgrade() -> None:
    now = datetime.utcnow()
    op.bulk_insert(
        game_scenarios_table,
        [
            {
                "template_key": "integralbuilder",
                "config": {
                    "template_key": "integralbuilder",
                    "initial_difficulty": 3,
                    "time_limit": 300,
                    "problems": INTEGRALBUILDER_PROBLEMS,
                },
                "status": "published",
                "created_by_admin_id": None,
                "published_at": now,
                "created_at": now,
            },
            {
                "template_key": "mathlab",
                "config": {
                    "template_key": "mathlab",
                    "mode": "derivatives",
                    "difficulty": 3,
                    "tasks": MATHLAB_DERIVATIVE_TASKS,
                },
                "status": "published",
                "created_by_admin_id": None,
                "published_at": now,
                "created_at": now,
            },
            {
                "template_key": "mathlab",
                "config": {
                    "template_key": "mathlab",
                    "mode": "integrals",
                    "difficulty": 4,
                    "tasks": MATHLAB_INTEGRAL_TASKS,
                },
                "status": "published",
                "created_by_admin_id": None,
                "published_at": now,
                "created_at": now,
            },
        ],
    )


def downgrade() -> None:
    op.execute(
        "DELETE FROM game_scenarios WHERE template_key IN ('integralbuilder', 'mathlab') AND created_by_admin_id IS NULL"
    )
