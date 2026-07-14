"""add_attempts_dashboard_index

Revision ID: 9af2ea949ea8
Revises: f99c286ee7c4
Create Date: 2026-07-14 11:39:12.056759

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9af2ea949ea8'
down_revision: Union[str, None] = 'f99c286ee7c4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # R3 task 7: без этого индекса dashboard-агрегации (активность за период,
    # завершаемость игр по content_type, прогресс по темам) упираются в full
    # scan attempts на реальном объёме — см. docs/roadmap/product-technical-plan.md R3 §4.3.
    op.create_index(
        'ix_attempts_created_at_content_type_skill_id',
        'attempts', ['created_at', 'content_type', 'skill_id'],
    )


def downgrade() -> None:
    op.drop_index('ix_attempts_created_at_content_type_skill_id', table_name='attempts')
