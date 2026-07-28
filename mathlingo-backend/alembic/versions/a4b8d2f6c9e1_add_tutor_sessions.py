"""add tutor_sessions (календарь конференций репетитора)

Revision ID: a4b8d2f6c9e1
Revises: f3a9c7e2b1d4
Create Date: 2026-07-21

Платформа репетиторов, Фаза 5: запланированные занятия/конференции
между репетитором и учеником (кто/когда + ссылка на видеосвязь).
"""
from alembic import op
import sqlalchemy as sa

revision = "a4b8d2f6c9e1"
down_revision = "f3a9c7e2b1d4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "tutor_sessions",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("tutor_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("starts_at", sa.DateTime(), nullable=False, index=True),
        sa.Column("duration_min", sa.Integer(), nullable=False, server_default="60"),
        sa.Column("title", sa.String(), nullable=True),
        sa.Column("meeting_url", sa.String(), nullable=True),
        sa.Column("note", sa.String(), nullable=True),
        sa.Column("status", sa.String(), nullable=False, server_default="scheduled"),
        sa.Column("created_at", sa.DateTime(), nullable=True),
    )
    # Агенда репетитора и ученика — выборки по (владелец, время); индекс под обе.
    op.create_index("ix_tutor_sessions_tutor_starts", "tutor_sessions", ["tutor_id", "starts_at"])
    op.create_index("ix_tutor_sessions_student_starts", "tutor_sessions", ["student_id", "starts_at"])


def downgrade() -> None:
    op.drop_index("ix_tutor_sessions_student_starts", table_name="tutor_sessions")
    op.drop_index("ix_tutor_sessions_tutor_starts", table_name="tutor_sessions")
    op.drop_table("tutor_sessions")
