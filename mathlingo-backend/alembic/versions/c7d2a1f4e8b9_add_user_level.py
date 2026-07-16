"""add user.level (учебный трек)

Revision ID: c7d2a1f4e8b9
Revises: b4e1c7a92f30
Create Date: 2026-07-16

Учебный уровень ученика (school|student|advanced) — задаёт, какие игры
показывать в едином каталоге. NULL = ещё не выбран.
"""
from alembic import op
import sqlalchemy as sa

revision = "c7d2a1f4e8b9"
down_revision = "b4e1c7a92f30"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("level", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "level")
