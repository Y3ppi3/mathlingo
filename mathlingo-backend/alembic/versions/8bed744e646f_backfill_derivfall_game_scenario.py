"""backfill_derivfall_game_scenario

Revision ID: 8bed744e646f
Revises: e89701f24df9
Create Date: 2026-07-14 10:23:37.940206

"""
from datetime import datetime
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8bed744e646f'
down_revision: Union[str, None] = 'e89701f24df9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# R3 task 3: DerivFall.tsx перестаёт содержать DEFAULT_PROBLEMS и полностью
# переходит на конфиг из game_scenarios (см. app/routes/gamification.py
# get_active_game_scenario) — без этой записи игра "пропадёт" сразу после
# деплоя, пока никто не создал сценарий через конструктор (которого ещё нет,
# он появится в R3 task 5). Список задач — 1:1 копия удаляемого
# DEFAULT_PROBLEMS из DerivFall.tsx на момент миграции.
DERIVFALL_PROBLEMS = [
    {"id": "d1", "problem": "(x^3)' = ?", "options": ["3x^2", "3x^4", "4x^3", "x^2"], "answer": "3x^2", "difficulty": "easy"},
    {"id": "d2", "problem": "(x^7)' = ?", "options": ["7x^6", "6x^5", "7x^8", "x^6"], "answer": "7x^6", "difficulty": "medium"},
    {"id": "d3", "problem": "(x^{-2})' = ?", "options": ["-2x^{-3}", "\\dfrac{2}{x^3}", "-\\dfrac{2}{x^3}", "-x^{-3}"], "answer": "-2x^{-3}", "difficulty": "hard"},
    {"id": "d4", "problem": "(\\sqrt{x})' = ?", "options": ["\\dfrac{1}{2\\sqrt{x}}", "2\\sqrt{x}", "\\dfrac{\\sqrt{x}}{2}", "\\dfrac{1}{\\sqrt{x}}"], "answer": "\\dfrac{1}{2\\sqrt{x}}", "difficulty": "hard"},
    {"id": "d5", "problem": "((5x+2)^{-3})' = ?", "options": ["-15(5x+2)^{-4}", "-3(5x+2)^{-4}", "-5(5x+2)^{-4}", "-15(5x+2)^{-2}"], "answer": "-15(5x+2)^{-4}", "difficulty": "hard"},
    {"id": "d6", "problem": "(\\sin x)' = ?", "options": ["\\cos x", "-\\sin x", "\\tan x", "\\sec^2 x"], "answer": "\\cos x", "difficulty": "easy"},
    {"id": "d7", "problem": "(e^x)' = ?", "options": ["e^x", "xe^x", "e^{x-1}", "\\ln(x)\\cdot e^x"], "answer": "e^x", "difficulty": "easy"},
    {"id": "d8", "problem": "(\\ln x)' = ?", "options": ["\\dfrac{1}{x}", "\\dfrac{\\ln x}{x}", "x^{-1}", "\\dfrac{1}{\\ln x}"], "answer": "\\dfrac{1}{x}", "difficulty": "medium"},
    {"id": "d9", "problem": "(\\cos x)' = ?", "options": ["-\\sin x", "\\sin x", "-\\cos x", "\\tan x"], "answer": "-\\sin x", "difficulty": "easy"},
    {"id": "d10", "problem": "(\\tan x)' = ?", "options": ["\\sec^2 x", "-\\csc^2 x", "\\dfrac{1}{\\cos^2 x}", "\\dfrac{\\sin x}{\\cos^2 x}"], "answer": "\\sec^2 x", "difficulty": "medium"},
    {"id": "d11", "problem": "(x^2 + 3x)' = ?", "options": ["2x + 3", "2x^2 + 3", "x + 3", "2x + 3x^2"], "answer": "2x + 3", "difficulty": "easy"},
    {"id": "d12", "problem": "(x \\cdot \\sin x)' = ?", "options": ["\\sin x + x\\cos x", "x\\cos x", "\\sin x - x\\cos x", "\\cos x + x\\sin x"], "answer": "\\sin x + x\\cos x", "difficulty": "medium"},
    {"id": "d13", "problem": "(x^2 \\cdot e^x)' = ?", "options": ["2x e^x + x^2 e^x", "2x e^x", "x^2 e^x", "2x + e^x"], "answer": "2x e^x + x^2 e^x", "difficulty": "hard"},
    {"id": "d14", "problem": "\\left(\\dfrac{1}{x}\\right)' = ?", "options": ["-\\dfrac{1}{x^2}", "\\dfrac{1}{x^2}", "-x^{-1}", "\\ln x"], "answer": "-\\dfrac{1}{x^2}", "difficulty": "medium"},
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
        [{
            "template_key": "derivfall",
            "config": {
                "template_key": "derivfall",
                "difficulty": 3,
                "time_limit": 60,
                "problems": DERIVFALL_PROBLEMS,
            },
            "status": "published",
            "created_by_admin_id": None,
            "published_at": now,
            "created_at": now,
        }],
    )


def downgrade() -> None:
    op.execute(
        "DELETE FROM game_scenarios WHERE template_key = 'derivfall' AND created_by_admin_id IS NULL"
    )
