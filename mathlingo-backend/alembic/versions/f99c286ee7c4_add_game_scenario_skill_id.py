"""add_game_scenario_skill_id

Revision ID: f99c286ee7c4
Revises: c6354c45add1
Create Date: 2026-07-14 11:19:22.142860

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f99c286ee7c4'
down_revision: Union[str, None] = 'c6354c45add1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('game_scenarios', sa.Column('skill_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_game_scenarios_skill_id', 'game_scenarios', 'skills', ['skill_id'], ['id']
    )


def downgrade() -> None:
    op.drop_constraint('fk_game_scenarios_skill_id', 'game_scenarios', type_='foreignkey')
    op.drop_column('game_scenarios', 'skill_id')
