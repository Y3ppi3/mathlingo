"""add tutor platform (профили репетиторов + связь с учениками)

Revision ID: e2f8a4c6d1b3
Revises: d5e9b3c1a7f2
Create Date: 2026-07-18

Фаза 1 платформы репетиторов: публичный профиль репетитора (маркетплейс) и
связь «репетитор ↔ ученик». Обе стороны — обычные users; профиль 1:1 с users
делает пользователя репетитором.
"""
from alembic import op
import sqlalchemy as sa

revision = "e2f8a4c6d1b3"
down_revision = "d5e9b3c1a7f2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "tutor_profiles",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("headline", sa.String(), nullable=False),
        sa.Column("bio", sa.String(), nullable=True),
        sa.Column("subjects", sa.JSON(), nullable=True),
        sa.Column("hourly_rate", sa.Integer(), nullable=True),
        sa.Column("is_listed", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.UniqueConstraint("user_id", name="uq_tutor_profile_user"),
    )
    op.create_index("ix_tutor_profiles_user_id", "tutor_profiles", ["user_id"])

    op.create_table(
        "tutor_students",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("tutor_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("status", sa.String(), nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.UniqueConstraint("tutor_id", "student_id", name="uq_tutor_student"),
    )
    op.create_index("ix_tutor_students_tutor_id", "tutor_students", ["tutor_id"])
    op.create_index("ix_tutor_students_student_id", "tutor_students", ["student_id"])


def downgrade() -> None:
    op.drop_index("ix_tutor_students_student_id", table_name="tutor_students")
    op.drop_index("ix_tutor_students_tutor_id", table_name="tutor_students")
    op.drop_table("tutor_students")
    op.drop_index("ix_tutor_profiles_user_id", table_name="tutor_profiles")
    op.drop_table("tutor_profiles")
