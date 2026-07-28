"""add tutor_assignments (задания репетитора ученику)

Revision ID: f3a9c7e2b1d4
Revises: e2f8a4c6d1b3
Create Date: 2026-07-21

Платформа репетиторов, Фаза 3: репетитор назначает ученику задание
(игра / номер экзамена / произвольное) со сроком и отметкой о выполнении.
"""
from alembic import op
import sqlalchemy as sa

revision = "f3a9c7e2b1d4"
down_revision = "e2f8a4c6d1b3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "tutor_assignments",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("tutor_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("kind", sa.String(), nullable=False, server_default="custom"),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("link", sa.String(), nullable=True),
        sa.Column("note", sa.String(), nullable=True),
        sa.Column("due_at", sa.DateTime(), nullable=True),
        sa.Column("status", sa.String(), nullable=False, server_default="assigned"),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
    )
    # Выборки идут по (репетитор+ученик) и по (ученик) — под оба разреза индексы.
    op.create_index("ix_tutor_assignments_tutor_student", "tutor_assignments", ["tutor_id", "student_id"])


def downgrade() -> None:
    op.drop_index("ix_tutor_assignments_tutor_student", table_name="tutor_assignments")
    op.drop_table("tutor_assignments")
