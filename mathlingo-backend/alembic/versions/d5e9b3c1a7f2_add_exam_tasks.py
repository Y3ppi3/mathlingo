"""add exam_tasks (банк ОГЭ/ЕГЭ)

Revision ID: d5e9b3c1a7f2
Revises: c7d2a1f4e8b9
Create Date: 2026-07-16

Банк заданий подготовки к экзаменам (ОГЭ/ЕГЭ) — отдельная таблица от tasks,
свой таксономический разрез (экзамен/трек/номер КИМ/тема) и большие объёмы.
"""
from alembic import op
import sqlalchemy as sa

revision = "d5e9b3c1a7f2"
down_revision = "c7d2a1f4e8b9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "exam_tasks",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("exam", sa.String(), nullable=False, index=True),
        sa.Column("track", sa.String(), nullable=True, index=True),
        sa.Column("task_number", sa.Integer(), nullable=True, index=True),
        sa.Column("topic", sa.String(), nullable=True, index=True),
        sa.Column("difficulty", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("statement", sa.String(), nullable=False),
        sa.Column("answer_type", sa.String(), nullable=False, server_default="single_answer"),
        sa.Column("answer", sa.String(), nullable=True),
        sa.Column("choices", sa.JSON(), nullable=True),
        sa.Column("solution", sa.String(), nullable=True),
        sa.Column("source", sa.String(), nullable=False, server_default="manual"),
        sa.Column("external_id", sa.String(), nullable=True, index=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
    )
    # Составной индекс под навигацию курса: экзамен → трек → номер задания.
    op.create_index("ix_exam_tasks_exam_track_number", "exam_tasks", ["exam", "track", "task_number"])


def downgrade() -> None:
    op.drop_index("ix_exam_tasks_exam_track_number", table_name="exam_tasks")
    op.drop_table("exam_tasks")
