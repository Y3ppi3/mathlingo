"""add tutor_content (свой контент репетитора)

Revision ID: b7c1e5a9d3f4
Revises: a4b8d2f6c9e1
Create Date: 2026-07-21

Платформа репетиторов, Фаза 4: библиотека собственных задач/материалов
репетитора, которые он назначает ученикам.
"""
from alembic import op
import sqlalchemy as sa

revision = "b7c1e5a9d3f4"
down_revision = "a4b8d2f6c9e1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "tutor_content",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("tutor_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("kind", sa.String(), nullable=False, server_default="material"),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("body", sa.String(), nullable=True),
        sa.Column("answer", sa.String(), nullable=True),
        sa.Column("attachment_url", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("tutor_content")
